from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import uuid
import json
import re
import io
import logging
import random
from pathlib import Path
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ── Models ──────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str
    company_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class TransactionCreate(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category: str
    vendor: Optional[str] = ""
    payment_method: Optional[str] = ""
    notes: Optional[str] = ""


# ── Auth Helpers ────────────────────────────────────────
def create_token(user_id: str, email: str):
    return jwt.encode({"user_id": user_id, "email": email}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Auth Routes ─────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password_hash": pwd_context.hash(data.password),
        "company_name": data.company_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, data.email)
    return {
        "token": token,
        "user": {"id": user_id, "email": data.email, "company_name": data.company_name}
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not pwd_context.verify(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "company_name": user.get("company_name", "")}
    }

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user


# ── Transaction Routes ──────────────────────────────────
@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate, user=Depends(get_current_user)):
    txn = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)
    return txn

@api_router.get("/transactions")
async def list_transactions(
    type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    query = {"user_id": user["id"]}
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    return txns

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, user=Depends(get_current_user)):
    result = await db.transactions.delete_one({"id": transaction_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Transaction not found")
    return {"message": "Transaction deleted"}

@api_router.post("/transactions/upload")
async def upload_transactions(file: UploadFile = File(...), user=Depends(get_current_user)):
    content = await file.read()
    filename = file.filename.lower()

    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(400, "Unsupported file format. Use CSV or Excel (.xlsx).")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {str(e)}")

    col_map = {}
    for col in df.columns:
        cl = col.lower().strip()
        if cl in ['date', 'transaction_date', 'trans_date']:
            col_map['date'] = col
        elif cl in ['description', 'desc', 'details', 'memo', 'narration']:
            col_map['description'] = col
        elif cl in ['amount', 'value', 'total', 'sum']:
            col_map['amount'] = col
        elif cl in ['type', 'transaction_type', 'trans_type']:
            col_map['type'] = col
        elif cl in ['category', 'cat']:
            col_map['category'] = col
        elif cl in ['vendor', 'supplier', 'payee', 'merchant']:
            col_map['vendor'] = col
        elif cl in ['payment_method', 'payment', 'method']:
            col_map['payment_method'] = col
        elif cl in ['notes', 'note', 'remarks']:
            col_map['notes'] = col

    if 'amount' not in col_map:
        raise HTTPException(400, "Could not find an 'amount' column in the file.")

    transactions = []
    for _, row in df.iterrows():
        try:
            raw_amount = row[col_map['amount']]
            if pd.isna(raw_amount):
                continue
            amount = float(raw_amount)
        except (ValueError, TypeError):
            continue

        def safe_get(key, default=''):
            if key not in col_map:
                return default
            val = row.get(col_map[key], default)
            if pd.isna(val):
                return default
            return str(val)

        txn_type = safe_get('type', 'expense').lower()
        if txn_type not in ('income', 'expense'):
            txn_type = 'expense' if amount > 0 else 'income'
            amount = abs(amount)

        txn = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "date": safe_get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d')),
            "description": safe_get('description', 'N/A'),
            "amount": abs(amount),
            "type": txn_type,
            "category": safe_get('category', 'Uncategorized'),
            "vendor": safe_get('vendor', ''),
            "payment_method": safe_get('payment_method', ''),
            "notes": safe_get('notes', ''),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        transactions.append(txn)

    if transactions:
        await db.transactions.insert_many(transactions)

    return {"count": len(transactions), "message": f"Successfully uploaded {len(transactions)} transactions"}


# ── Demo Data ───────────────────────────────────────────
@api_router.post("/transactions/demo")
async def load_demo_data(user=Depends(get_current_user)):
    await db.transactions.delete_many({"user_id": user["id"]})
    await db.analyses.delete_many({"user_id": user["id"]})
    txns = _generate_demo_data(user["id"])
    await db.transactions.insert_many(txns)
    return {"count": len(txns), "message": f"Loaded {len(txns)} demo transactions"}

def _generate_demo_data(user_id):
    income_cats = ["Sales Revenue", "Consulting Fees", "Service Revenue", "Investment Returns", "Refunds"]
    expense_cats = ["Office Rent", "Salaries", "Software Subscriptions", "Marketing", "Equipment",
                    "Travel", "Insurance", "Utilities", "Professional Services", "Miscellaneous"]
    income_vendors = ["Acme Corp", "Global Tech Inc", "Summit Partners", "Horizon Digital", "Pinnacle Solutions"]
    expense_vendors = ["WeWork Spaces", "Adobe Inc", "Google Ads", "Amazon AWS", "Slack Technologies",
                       "Microsoft", "Delta Airlines", "Blue Cross Insurance", "ComEd Utilities",
                       "McKinsey Consulting", "Zoom Video", "GitHub Inc", "Salesforce", "FedEx", "Staples"]
    methods = ["Bank Transfer", "Credit Card", "Wire Transfer", "Check", "ACH"]

    txns = []
    for month in range(1, 7):
        for _ in range(random.randint(4, 8)):
            txns.append({
                "id": str(uuid.uuid4()), "user_id": user_id,
                "date": f"2025-{month:02d}-{random.randint(1, 28):02d}",
                "description": f"Payment from {random.choice(income_vendors)} - {random.choice(income_cats)}",
                "amount": round(random.uniform(5000, 50000), 2), "type": "income",
                "category": random.choice(income_cats), "vendor": random.choice(income_vendors),
                "payment_method": random.choice(methods), "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        for _ in range(random.randint(12, 22)):
            txns.append({
                "id": str(uuid.uuid4()), "user_id": user_id,
                "date": f"2025-{month:02d}-{random.randint(1, 28):02d}",
                "description": f"{random.choice(expense_cats)} - {random.choice(expense_vendors)}",
                "amount": round(random.uniform(200, 15000), 2), "type": "expense",
                "category": random.choice(expense_cats), "vendor": random.choice(expense_vendors),
                "payment_method": random.choice(methods), "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

    # Suspicious: duplicate payment
    if txns:
        dup = dict(txns[5])
        dup["id"] = str(uuid.uuid4())
        txns.append(dup)

    # Suspicious: unusually large
    txns.append({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "date": "2025-04-15",
        "description": "Consulting Services - Offshore Partner LLC",
        "amount": 95000, "type": "expense",
        "category": "Professional Services", "vendor": "Offshore Partner LLC",
        "payment_method": "Wire Transfer", "notes": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Suspicious: just below approval limit
    txns.append({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "date": "2025-05-22",
        "description": "Equipment Purchase - Unknown Vendor Co",
        "amount": 9999, "type": "expense",
        "category": "Equipment", "vendor": "Unknown Vendor Co",
        "payment_method": "Credit Card", "notes": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return txns


# ── Dashboard ───────────────────────────────────────────
@api_router.get("/dashboard")
async def get_dashboard(user=Depends(get_current_user)):
    user_id = user["id"]
    txns = await db.transactions.find({"user_id": user_id}, {"_id": 0}).to_list(10000)

    if not txns:
        return {
            "total_income": 0, "total_expenses": 0, "net_profit": 0, "profit_margin": 0,
            "transaction_count": 0, "recent_transactions": [], "monthly_data": [],
            "expense_by_category": [], "latest_analysis": None
        }

    total_income = sum(t["amount"] for t in txns if t.get("type") == "income")
    total_expenses = sum(t["amount"] for t in txns if t.get("type") == "expense")
    net_profit = total_income - total_expenses
    profit_margin = round((net_profit / total_income * 100), 1) if total_income > 0 else 0

    monthly = {}
    for t in txns:
        m = t.get("date", "")[:7]
        if not m:
            continue
        if m not in monthly:
            monthly[m] = {"month": m, "income": 0, "expenses": 0}
        if t.get("type") == "income":
            monthly[m]["income"] += t["amount"]
        else:
            monthly[m]["expenses"] += t["amount"]
    monthly_data = sorted(monthly.values(), key=lambda x: x["month"])
    for md in monthly_data:
        md["income"] = round(md["income"], 2)
        md["expenses"] = round(md["expenses"], 2)

    cat_expenses = {}
    for t in txns:
        if t.get("type") == "expense":
            cat = t.get("category", "Uncategorized")
            cat_expenses[cat] = cat_expenses.get(cat, 0) + t["amount"]
    expense_by_category = [{"name": k, "value": round(v, 2)} for k, v in sorted(cat_expenses.items(), key=lambda x: -x[1])]

    recent = sorted(txns, key=lambda x: x.get("date", ""), reverse=True)[:10]

    analysis_cursor = db.analyses.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(1)
    analysis_list = await analysis_cursor.to_list(1)
    latest_analysis = analysis_list[0] if analysis_list else None

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(net_profit, 2),
        "profit_margin": profit_margin,
        "transaction_count": len(txns),
        "recent_transactions": recent,
        "monthly_data": monthly_data,
        "expense_by_category": expense_by_category,
        "latest_analysis": latest_analysis
    }


# ── AI Analysis ─────────────────────────────────────────
def _parse_json_response(text):
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None

@api_router.post("/analysis/run")
async def run_analysis(user=Depends(get_current_user)):
    user_id = user["id"]
    company = user.get("company_name", "Your Company")
    txns = await db.transactions.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    if not txns:
        raise HTTPException(400, "No transactions found. Upload or add transactions first.")

    total_income = sum(t["amount"] for t in txns if t.get("type") == "income")
    total_expenses = sum(t["amount"] for t in txns if t.get("type") == "expense")
    dates = [t["date"] for t in txns if t.get("date")]

    condensed = json.dumps([{
        "date": t.get("date", ""), "description": t.get("description", ""),
        "amount": t["amount"], "type": t.get("type", ""), "category": t.get("category", ""),
        "vendor": t.get("vendor", "")
    } for t in txns[:200]], indent=2)

    prompt = f"""Analyze the following financial data for {company}.

Summary:
- Total Transactions: {len(txns)}
- Date Range: {min(dates) if dates else 'N/A'} to {max(dates) if dates else 'N/A'}
- Total Income: ${total_income:,.2f}
- Total Expenses: ${total_expenses:,.2f}
- Net Profit: ${total_income - total_expenses:,.2f}

Transaction Data (up to 200 records):
{condensed}

Provide a comprehensive CFO and audit analysis as a JSON object with EXACTLY this structure (return ONLY raw JSON, no markdown):
{{
  "financial_summary": {{
    "health_score": 0,
    "health_rating": "Good",
    "total_revenue": 0,
    "total_expenses": 0,
    "net_profit": 0,
    "profit_margin": 0,
    "key_insights": ["insight1", "insight2", "insight3"],
    "recommendations": ["rec1", "rec2", "rec3"]
  }},
  "cash_flow": {{
    "net_cash_flow": 0,
    "burn_rate": 0,
    "cash_runway_months": 0,
    "trend": "stable",
    "insights": ["insight1", "insight2"]
  }},
  "profit_leaks": {{
    "total_leaks_amount": 0,
    "findings": [
      {{"category": "cat", "description": "desc", "amount": 0, "severity": "high", "recommendation": "rec"}}
    ]
  }},
  "fraud_detection": {{
    "risk_level": "low",
    "flagged_transactions": [
      {{"description": "desc", "amount": 0, "reason": "reason", "risk_score": 50}}
    ]
  }},
  "vendor_risk": {{
    "vendors": [
      {{"name": "vendor", "total_payments": 0, "transaction_count": 0, "risk_score": 30, "risk_factors": ["factor"]}}
    ]
  }},
  "audit_score": {{
    "overall_score": 0,
    "rating": "Low Risk",
    "factors": [
      {{"name": "factor", "score": 0, "impact": "positive", "description": "desc"}}
    ]
  }}
}}"""

    try:
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"analysis-{user_id}-{str(uuid.uuid4())[:8]}",
            system_message="You are an expert AI CFO and Internal Auditor. Analyze financial data thoroughly. Return ONLY valid JSON, no markdown."
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=prompt))
        data = _parse_json_response(response)
        if not data:
            logger.error(f"Failed to parse AI response: {response[:500]}")
            raise Exception("Failed to parse AI response")

        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "data": data,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.analyses.insert_one(doc)
        return {"id": doc["id"], "data": data, "created_at": doc["created_at"]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(500, f"Analysis failed: {str(e)}")

@api_router.get("/analysis/latest")
async def get_latest_analysis(user=Depends(get_current_user)):
    cursor = db.analyses.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(1)
    results = await cursor.to_list(1)
    if not results:
        return None
    return results[0]


# ── App Setup ───────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
