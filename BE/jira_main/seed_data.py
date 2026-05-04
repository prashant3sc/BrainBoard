"""
BrainBoard comprehensive seed script — v2
==========================================
Clears ALL existing data and seeds fresh:

Users   : 1 admin · 4 PMs · 8 developers · 5 viewers  (password: Test@123)
Projects: 6 domain-specific projects
           1. SupplySync  — Supply-chain management platform
           2. QuickBite   — Food-delivery app
           3. RideFlow    — Cab / ride-hailing service
           4. StayEase    — Hotel booking platform
           5. LearnHub    — Online learning management system
           6. MediConnect — Healthcare appointment & records platform
Labels  : 6+ per project (domain-specific)
Sprints : 5+ per project (mix of completed / active / planned)
Issues  : 20+ per sprint with varied statuses + 10 backlog issues per project
Wiki    : 1 space per project + multiple pages

After Postgres seeding it calls the AI-sync endpoint to populate ChromaDB.

Usage:
  cd BE
  source hack_env/Scripts/activate   # Windows: hack_env\\Scripts\\activate
  cd jira_main
  python seed_data.py
"""

import os
import sys
import random
import django
import requests
from datetime import date, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jira_main.settings")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction
from issues.models import Issue, Label
from projects.models import Project, ProjectMember, Sprint
from wiki.models import WikiSpace, WikiPage

User = get_user_model()

AI_BASE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")
SYNC_TO_CHROMA = True

random.seed(42)

# ── helpers ───────────────────────────────────────────────────────────────────

def p(msg):
    print(f"  {msg}")

def sprint_window(start_offset_weeks: int, length_weeks: int = 2):
    start = date.today() + timedelta(weeks=start_offset_weeks)
    return start, start + timedelta(weeks=length_weeks)

def pick(seq):
    return random.choice(seq)

STATUSES = ["todo", "in_progress", "review", "done"]
PRIOS    = ["critical", "high", "medium", "low"]
TYPES    = ["task", "bug", "task", "task"]   # weighted towards task

def rand_status():  return pick(STATUSES)
def rand_prio():    return pick(PRIOS)
def rand_type():    return pick(TYPES)

# ── STEP 0: WIPE ──────────────────────────────────────────────────────────────

print("\n[0] Clearing existing data …")

with transaction.atomic():
    Issue.objects.all().delete()
    Label.objects.all().delete()
    Sprint.objects.all().delete()
    WikiPage.objects.all().delete()
    WikiSpace.objects.all().delete()
    ProjectMember.objects.all().delete()
    Project.objects.all().delete()
    User.objects.filter(is_superuser=False).delete()

p("Postgres wiped.")

# Wipe ChromaDB
try:
    import chromadb
    from jira_main.settings import CHROMA_DB_DIR, CHROMA_COLLECTION  # type: ignore
    _chroma = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    try:
        _chroma.delete_collection(CHROMA_COLLECTION)
        p("ChromaDB collection dropped.")
    except Exception:
        p("ChromaDB collection did not exist — skipping.")
except Exception as e:
    p(f"ChromaDB wipe skipped ({e})")

# ── STEP 1: USERS ─────────────────────────────────────────────────────────────

print("\n[1] Creating users …")

PWD = "Test@123"

def make_user(username, email, name, role, is_staff=False, is_superuser=False):
    parts = name.split(" ", 1)
    first_name = parts[0]
    last_name  = parts[1] if len(parts) > 1 else ""
    u = User.objects.create_user(
        email=email, password=PWD,
        username=username,
        role=role, is_staff=is_staff, is_superuser=is_superuser,
        first_name=first_name, last_name=last_name,
    )
    return u

# Admin
admin = make_user("admin_raj", "admin.raj@brainboard.io", "Rajesh Kumar", "admin",
                  is_staff=True, is_superuser=True)
p(f"admin  : {admin.username}")

# PMs
pm_names = [
    ("pm_priya",   "priya.sharma@brainboard.io",   "Priya Sharma",   "pm"),
    ("pm_arjun",   "arjun.mehta@brainboard.io",    "Arjun Mehta",    "pm"),
    ("pm_sara",    "sara.thomas@brainboard.io",     "Sara Thomas",    "pm"),
    ("pm_vikram",  "vikram.nair@brainboard.io",     "Vikram Nair",    "pm"),
]
pms = [make_user(*x) for x in pm_names]
for pm in pms: p(f"pm     : {pm.username}")

# Developers
dev_names = [
    ("dev_aisha",   "aisha.khan@brainboard.io",    "Aisha Khan",     "developer"),
    ("dev_rohan",   "rohan.gupta@brainboard.io",   "Rohan Gupta",    "developer"),
    ("dev_neha",    "neha.joshi@brainboard.io",    "Neha Joshi",     "developer"),
    ("dev_karan",   "karan.patel@brainboard.io",   "Karan Patel",    "developer"),
    ("dev_meera",   "meera.reddy@brainboard.io",   "Meera Reddy",    "developer"),
    ("dev_saurav",  "saurav.das@brainboard.io",    "Saurav Das",     "developer"),
    ("dev_tanvi",   "tanvi.singh@brainboard.io",   "Tanvi Singh",    "developer"),
    ("dev_amit",    "amit.bose@brainboard.io",     "Amit Bose",      "developer"),
]
devs = [make_user(*x) for x in dev_names]
for d in devs: p(f"dev    : {d.username}")

# Viewers
viewer_names = [
    ("view_pooja",  "pooja.iyer@brainboard.io",    "Pooja Iyer",     "viewer"),
    ("view_ankit",  "ankit.verma@brainboard.io",   "Ankit Verma",    "viewer"),
    ("view_divya",  "divya.menon@brainboard.io",   "Divya Menon",    "viewer"),
    ("view_rahul",  "rahul.mishra@brainboard.io",  "Rahul Mishra",   "viewer"),
    ("view_sneha",  "sneha.pillai@brainboard.io",  "Sneha Pillai",   "viewer"),
]
viewers = [make_user(*x) for x in viewer_names]
for v in viewers: p(f"viewer : {v.username}")

all_users = [admin] + pms + devs + viewers

# ── STEP 2: PROJECT DEFINITIONS ───────────────────────────────────────────────

print("\n[2] Building project definitions …")

# Each project: (key, name, desc, pm_index, dev_indices, viewer_indices, labels_def)
# label_def: list of (name, color)

PROJECTS_DEF = [

    # ── Project 1: Supply Chain Management ────────────────────────────────────
    {
        "key":   "SSYNC",
        "name":  "SupplySync",
        "desc":  "End-to-end supply-chain management platform covering procurement, inventory, logistics, and supplier collaboration.",
        "pm":    pms[0],
        "devs":  devs[:4],
        "viewers": viewers[:2],
        "labels": [
            ("Procurement",     "#F97316"),
            ("Inventory",       "#3B82F6"),
            ("Logistics",       "#10B981"),
            ("Supplier Portal", "#8B5CF6"),
            ("Analytics",       "#EF4444"),
            ("Compliance",      "#F59E0B"),
            ("API Integration", "#06B6D4"),
        ],
        "sprints": [
            {
                "name": "SSYNC Sprint 1 — Supplier Onboarding",
                "status": "completed",
                "offset": -10, "length": 2,
                "issues": [
                    ("Supplier registration form UI", "task", "high", "done", "Supplier Portal"),
                    ("Supplier KYC document upload endpoint", "task", "high", "done", "Supplier Portal"),
                    ("Email verification flow for new suppliers", "task", "medium", "done", "Supplier Portal"),
                    ("Supplier profile CRUD API", "task", "high", "done", "Supplier Portal"),
                    ("Supplier approval workflow — PM review step", "task", "critical", "done", "Compliance"),
                    ("Bug: duplicate supplier registration allowed", "bug", "critical", "done", "Supplier Portal"),
                    ("Supplier categories and commodity tagging", "task", "medium", "done", "Supplier Portal"),
                    ("Notification email on supplier approval/rejection", "task", "medium", "done", "Supplier Portal"),
                    ("Supplier dashboard — active contracts widget", "task", "low", "done", "Supplier Portal"),
                    ("Role-based access for supplier vs buyer", "task", "high", "done", "Compliance"),
                    ("Supplier search and filter API", "task", "medium", "done", "API Integration"),
                    ("Unit tests for supplier onboarding service", "task", "medium", "done", "Compliance"),
                    ("Supplier contract PDF generation", "task", "low", "review", "Supplier Portal"),
                    ("Bug: KYC upload fails for PDF > 5 MB", "bug", "high", "done", "Supplier Portal"),
                    ("Audit log for supplier status changes", "task", "medium", "done", "Compliance"),
                    ("Supplier rating and score model", "task", "low", "done", "Analytics"),
                    ("Integrate Twilio SMS for supplier OTP", "task", "medium", "in_progress", "API Integration"),
                    ("Pagination on supplier list endpoint", "task", "low", "done", "API Integration"),
                    ("Supplier portal mobile responsive layout", "task", "medium", "done", "Supplier Portal"),
                    ("End-to-end test: full supplier registration journey", "task", "high", "done", "Compliance"),
                    ("Supplier bulk import via CSV", "task", "medium", "done", "Supplier Portal"),
                ],
            },
            {
                "name": "SSYNC Sprint 2 — Procurement Module",
                "status": "completed",
                "offset": -8, "length": 2,
                "issues": [
                    ("Purchase order creation UI", "task", "high", "done", "Procurement"),
                    ("PO approval hierarchy — 3-level sign-off", "task", "critical", "done", "Procurement"),
                    ("Auto-generate PO number with project prefix", "task", "medium", "done", "Procurement"),
                    ("Bug: PO total calculation ignores tax", "bug", "critical", "done", "Procurement"),
                    ("Supplier quote comparison tool", "task", "high", "done", "Procurement"),
                    ("RFQ (Request for Quotation) workflow", "task", "high", "done", "Procurement"),
                    ("PO line-item split by warehouse", "task", "medium", "done", "Inventory"),
                    ("Budget utilisation dashboard widget", "task", "medium", "done", "Analytics"),
                    ("Procurement analytics — monthly spend chart", "task", "low", "done", "Analytics"),
                    ("PO PDF export and email to supplier", "task", "medium", "done", "Procurement"),
                    ("Goods receipt note (GRN) model and API", "task", "high", "done", "Procurement"),
                    ("Bug: PO status not updated after GRN creation", "bug", "high", "done", "Procurement"),
                    ("Three-way matching: PO vs GRN vs invoice", "task", "critical", "done", "Compliance"),
                    ("Vendor invoice upload and parsing", "task", "high", "done", "Procurement"),
                    ("Automated payment trigger on 3-way match", "task", "medium", "review", "Procurement"),
                    ("Procurement approval notifications (email + in-app)", "task", "medium", "done", "Procurement"),
                    ("Spend by category chart", "task", "low", "done", "Analytics"),
                    ("Early payment discount module", "task", "low", "todo", "Procurement"),
                    ("PO amendment and revision tracking", "task", "medium", "done", "Compliance"),
                    ("Integration test: RFQ → PO → GRN flow", "task", "high", "done", "Compliance"),
                    ("Procurement calendar — expected delivery dates", "task", "low", "done", "Procurement"),
                ],
            },
            {
                "name": "SSYNC Sprint 3 — Inventory Management",
                "status": "completed",
                "offset": -6, "length": 2,
                "issues": [
                    ("Warehouse and bin location model", "task", "high", "done", "Inventory"),
                    ("Stock receive and put-away workflow", "task", "high", "done", "Inventory"),
                    ("Real-time inventory level API", "task", "critical", "done", "Inventory"),
                    ("Low-stock alert engine and notifications", "task", "high", "done", "Inventory"),
                    ("Inventory transfer between warehouses", "task", "medium", "done", "Inventory"),
                    ("Barcode/QR scan for stock movements", "task", "high", "done", "Inventory"),
                    ("Bug: negative stock allowed on return", "bug", "critical", "done", "Inventory"),
                    ("FIFO / FEFO stock rotation logic", "task", "high", "done", "Inventory"),
                    ("Expiry date tracking for perishables", "task", "medium", "done", "Inventory"),
                    ("Cycle count / stocktake workflow", "task", "medium", "done", "Inventory"),
                    ("Inventory valuation report (FIFO cost)", "task", "medium", "done", "Analytics"),
                    ("Stock adjustment with reason codes", "task", "low", "done", "Inventory"),
                    ("Dead-stock identification report", "task", "low", "done", "Analytics"),
                    ("Warehouse capacity utilisation chart", "task", "low", "done", "Analytics"),
                    ("Bug: barcode scanner input drops last digit", "bug", "high", "done", "Inventory"),
                    ("Multi-unit-of-measure support (kg, pcs, litre)", "task", "medium", "done", "Inventory"),
                    ("Inventory forecast using 90-day history", "task", "high", "review", "Analytics"),
                    ("Minimum reorder quantity auto-PO trigger", "task", "high", "done", "Procurement"),
                    ("Batch/lot number tracking for compliance", "task", "medium", "done", "Compliance"),
                    ("Warehouse dashboard — live occupancy heatmap", "task", "low", "done", "Inventory"),
                    ("Performance test: 10k concurrent inventory reads", "task", "medium", "done", "Inventory"),
                ],
            },
            {
                "name": "SSYNC Sprint 4 — Logistics & Tracking",
                "status": "active",
                "offset": -2, "length": 2,
                "issues": [
                    ("Shipment creation and carrier assignment", "task", "high", "done", "Logistics"),
                    ("Real-time shipment GPS tracking widget", "task", "critical", "in_progress", "Logistics"),
                    ("Proof of delivery (POD) digital signature", "task", "high", "in_progress", "Logistics"),
                    ("Bug: shipment ETA calculation off by 1 day", "bug", "high", "in_progress", "Logistics"),
                    ("Carrier rate card management", "task", "medium", "done", "Logistics"),
                    ("Multi-stop route optimisation API", "task", "high", "todo", "Logistics"),
                    ("Customs and duty documentation module", "task", "medium", "todo", "Compliance"),
                    ("Return merchandise authorisation (RMA) flow", "task", "medium", "in_progress", "Logistics"),
                    ("Freight cost allocation per PO line", "task", "low", "todo", "Logistics"),
                    ("Last-mile delivery partner API integration", "task", "high", "in_progress", "API Integration"),
                    ("Shipment delay alert and customer notification", "task", "medium", "todo", "Logistics"),
                    ("Cold-chain temperature log for perishables", "task", "high", "in_progress", "Compliance"),
                    ("Carrier performance scorecard", "task", "low", "todo", "Analytics"),
                    ("Bulk shipment label printing (ZPL format)", "task", "medium", "done", "Logistics"),
                    ("Bug: POD image upload fails on Safari", "bug", "medium", "todo", "Logistics"),
                    ("Cross-border shipment compliance checklist", "task", "medium", "todo", "Compliance"),
                    ("Delivery SLA tracking and breach alerts", "task", "high", "in_progress", "Analytics"),
                    ("Fleet management — vehicle maintenance schedule", "task", "low", "todo", "Logistics"),
                    ("Logistics cost dashboard — per-kg cost trend", "task", "low", "todo", "Analytics"),
                    ("Integration: FedEx / DHL webhook events", "task", "high", "in_progress", "API Integration"),
                    ("End-to-end test: shipment lifecycle", "task", "high", "todo", "Logistics"),
                ],
            },
            {
                "name": "SSYNC Sprint 5 — Analytics & Reporting",
                "status": "planned",
                "offset": 2, "length": 2,
                "issues": [
                    ("Executive supply-chain KPI dashboard", "task", "high", "todo", "Analytics"),
                    ("Supplier on-time delivery (OTD) report", "task", "high", "todo", "Analytics"),
                    ("Inventory turnover ratio chart", "task", "medium", "todo", "Analytics"),
                    ("Perfect order rate calculation", "task", "medium", "todo", "Analytics"),
                    ("Cash-to-cash cycle time report", "task", "medium", "todo", "Analytics"),
                    ("Spend analysis by category heatmap", "task", "low", "todo", "Analytics"),
                    ("Forecast accuracy report", "task", "medium", "todo", "Analytics"),
                    ("Carbon footprint per shipment report", "task", "low", "todo", "Compliance"),
                    ("Compliance audit trail export (PDF/Excel)", "task", "high", "todo", "Compliance"),
                    ("Custom report builder with drag-and-drop", "task", "high", "todo", "Analytics"),
                    ("Scheduled email reports (daily/weekly)", "task", "medium", "todo", "Analytics"),
                    ("Anomaly detection: sudden price spikes", "task", "high", "todo", "Analytics"),
                    ("Supplier risk score aggregation", "task", "medium", "todo", "Supplier Portal"),
                    ("Bug: report CSV export missing last row", "bug", "medium", "todo", "Analytics"),
                    ("Cost-saving opportunity recommendations (AI)", "task", "high", "todo", "Analytics"),
                    ("Drill-down: click metric → underlying orders", "task", "medium", "todo", "Analytics"),
                    ("Mobile-optimised dashboard view", "task", "low", "todo", "Analytics"),
                    ("Role-based report access control", "task", "medium", "todo", "Compliance"),
                    ("Historical data import from legacy ERP", "task", "high", "todo", "API Integration"),
                    ("Performance: report generation < 3s for 1M rows", "task", "high", "todo", "Analytics"),
                    ("User-defined KPI targets and RAG status", "task", "low", "todo", "Analytics"),
                ],
            },
        ],
        "backlog": [
            ("EDI integration with major retailers", "task", "high", "API Integration"),
            ("Supplier portal mobile app (React Native)", "task", "medium", "Supplier Portal"),
            ("Predictive demand forecasting ML model", "task", "high", "Analytics"),
            ("Multi-currency and multi-language support", "task", "medium", "Compliance"),
            ("Supplier self-service invoice portal", "task", "medium", "Supplier Portal"),
            ("Blockchain-based provenance tracking", "task", "low", "Compliance"),
            ("ERP connector: SAP S/4HANA adapter", "task", "high", "API Integration"),
            ("Dark mode for supplier portal", "task", "low", "Supplier Portal"),
            ("Automated sanction-list supplier screening", "task", "high", "Compliance"),
            ("API rate-limiting and throttling policy", "task", "medium", "API Integration"),
        ],
        "wiki_pages": [
            ("SupplySync Overview", "# SupplySync\n\nSupplySync is a comprehensive supply-chain management platform that digitises procurement, inventory, logistics, and supplier collaboration for mid-to-large enterprises.\n\n## Key Modules\n- **Supplier Portal** — Onboarding, KYC, rating\n- **Procurement** — RFQ → PO → GRN → Invoice\n- **Inventory** — Real-time stock, FIFO, multi-warehouse\n- **Logistics** — Shipment tracking, carrier management\n- **Analytics** — KPI dashboards, spend analysis", None),
            ("Supplier Onboarding Guide", "# Supplier Onboarding\n\n## Registration Steps\n1. Supplier visits portal and fills registration form\n2. Uploads KYC documents (GST, PAN, bank details)\n3. Receives OTP verification via SMS\n4. PM reviews and approves/rejects\n5. Approved supplier receives welcome email with portal credentials\n\n## KYC Requirements\n- GST Certificate\n- PAN Card\n- Cancelled cheque / bank statement\n- Company incorporation certificate", None),
            ("Procurement SOP", "# Standard Operating Procedure — Procurement\n\n## Purchase Order Lifecycle\n`Draft → Pending Approval → Approved → Sent to Supplier → GRN Received → Invoiced → Paid`\n\n## Approval Matrix\n| PO Value      | Approver       |\n|---------------|----------------|\n| < ₹1 Lakh     | Team Lead      |\n| ₹1L – ₹10L   | Finance Head   |\n| > ₹10 Lakh    | CFO            |\n\n## Three-Way Matching\nEvery invoice must match the PO and GRN within 2% tolerance before payment is triggered.", None),
            ("Inventory Management", "# Inventory Management\n\n## Stock Movement Types\n- **GRN** — Goods Receipt Note (inbound)\n- **GDN** — Goods Dispatch Note (outbound)\n- **STO** — Stock Transfer Order (warehouse-to-warehouse)\n- **ADJ** — Manual Adjustment with reason code\n\n## Reorder Logic\nWhen `qty_on_hand ≤ reorder_point`, the system auto-creates a draft PO with the preferred supplier at the minimum order quantity.", None),
            ("Logistics & Carrier Setup", "# Logistics Configuration\n\n## Carrier Onboarding\n1. Add carrier profile with GSTIN and service areas\n2. Upload rate card (weight breaks × zones)\n3. Configure webhook URL for tracking events\n4. Test with a sample shipment\n\n## Supported Carriers\n- FedEx (API v1)\n- DHL Express\n- Delhivery (domestic)\n- BlueDart (domestic priority)", None),
        ],
    },

    # ── Project 2: QuickBite — Food Delivery App ──────────────────────────────
    {
        "key":   "QBITE",
        "name":  "QuickBite",
        "desc":  "On-demand food delivery app connecting customers with local restaurants, with real-time order tracking and surge pricing.",
        "pm":    pms[1],
        "devs":  devs[2:6],
        "viewers": viewers[1:3],
        "labels": [
            ("Customer App",   "#F97316"),
            ("Restaurant App", "#10B981"),
            ("Delivery Agent", "#3B82F6"),
            ("Payments",       "#EF4444"),
            ("Notifications",  "#8B5CF6"),
            ("Search & Menu",  "#F59E0B"),
            ("Analytics",      "#06B6D4"),
        ],
        "sprints": [
            {
                "name": "QBITE Sprint 1 — Customer App Foundation",
                "status": "completed",
                "offset": -10, "length": 2,
                "issues": [
                    ("Customer registration and OTP login", "task", "critical", "done", "Customer App"),
                    ("Restaurant listing with cuisine filter", "task", "high", "done", "Search & Menu"),
                    ("Menu browse with photos and prices", "task", "high", "done", "Search & Menu"),
                    ("Add to cart and cart management", "task", "critical", "done", "Customer App"),
                    ("Address management (add, edit, delete)", "task", "high", "done", "Customer App"),
                    ("Bug: cart clears on app background", "bug", "critical", "done", "Customer App"),
                    ("Delivery time estimate on restaurant card", "task", "medium", "done", "Search & Menu"),
                    ("Restaurant rating and review system", "task", "medium", "done", "Search & Menu"),
                    ("Search by dish name or restaurant", "task", "high", "done", "Search & Menu"),
                    ("Customer profile edit screen", "task", "low", "done", "Customer App"),
                    ("Order history list", "task", "medium", "done", "Customer App"),
                    ("Reorder from past order", "task", "medium", "done", "Customer App"),
                    ("Dark mode support for customer app", "task", "low", "done", "Customer App"),
                    ("Bug: dish photos load slowly on 3G", "bug", "high", "done", "Search & Menu"),
                    ("Dietary filter (veg, vegan, gluten-free)", "task", "medium", "done", "Search & Menu"),
                    ("Restaurant closed / open status banner", "task", "medium", "done", "Restaurant App"),
                    ("App onboarding walkthrough screens", "task", "low", "done", "Customer App"),
                    ("Push notification opt-in prompt", "task", "medium", "done", "Notifications"),
                    ("Location permission handling gracefully", "task", "high", "done", "Customer App"),
                    ("Accessibility: screen reader labels on food cards", "task", "medium", "done", "Customer App"),
                    ("Unit tests for cart service", "task", "medium", "done", "Customer App"),
                ],
            },
            {
                "name": "QBITE Sprint 2 — Payments & Checkout",
                "status": "completed",
                "offset": -8, "length": 2,
                "issues": [
                    ("Razorpay / Stripe checkout integration", "task", "critical", "done", "Payments"),
                    ("COD (cash on delivery) option", "task", "high", "done", "Payments"),
                    ("Wallet top-up and balance deduction", "task", "high", "done", "Payments"),
                    ("Promo code and coupon engine", "task", "high", "done", "Payments"),
                    ("Bug: double charge on payment retry", "bug", "critical", "done", "Payments"),
                    ("Tax calculation (CGST + SGST per item)", "task", "high", "done", "Payments"),
                    ("Invoice PDF generation and email", "task", "medium", "done", "Payments"),
                    ("Refund workflow for cancelled orders", "task", "high", "done", "Payments"),
                    ("Payment failure retry screen", "task", "medium", "done", "Payments"),
                    ("Saved cards management (add/delete)", "task", "medium", "done", "Payments"),
                    ("UPI deep link integration", "task", "high", "done", "Payments"),
                    ("Bug: promo code case-sensitive mismatch", "bug", "medium", "done", "Payments"),
                    ("Delivery charge based on distance slab", "task", "medium", "done", "Payments"),
                    ("Surge pricing multiplier engine", "task", "high", "done", "Payments"),
                    ("Order confirmation screen with breakdown", "task", "medium", "done", "Customer App"),
                    ("Webhook handler for Razorpay events", "task", "high", "done", "Payments"),
                    ("Fraud detection: velocity check on promos", "task", "high", "done", "Payments"),
                    ("Tip for delivery agent at checkout", "task", "low", "done", "Payments"),
                    ("PCI-DSS compliance checklist review", "task", "critical", "done", "Payments"),
                    ("Load test: 500 concurrent checkouts", "task", "high", "done", "Payments"),
                    ("GSTIN invoice for business customers", "task", "low", "done", "Payments"),
                ],
            },
            {
                "name": "QBITE Sprint 3 — Restaurant Dashboard",
                "status": "completed",
                "offset": -6, "length": 2,
                "issues": [
                    ("Restaurant owner onboarding wizard", "task", "high", "done", "Restaurant App"),
                    ("Menu management — add/edit/archive dishes", "task", "critical", "done", "Restaurant App"),
                    ("Live order queue for kitchen staff", "task", "critical", "done", "Restaurant App"),
                    ("Bug: order notification not ringing on iPad", "bug", "high", "done", "Restaurant App"),
                    ("Prep time management per dish category", "task", "medium", "done", "Restaurant App"),
                    ("Restaurant open/close toggle with schedule", "task", "high", "done", "Restaurant App"),
                    ("Daily earnings summary card", "task", "medium", "done", "Analytics"),
                    ("Menu item availability toggle (out-of-stock)", "task", "high", "done", "Restaurant App"),
                    ("Bulk menu import via CSV", "task", "medium", "done", "Restaurant App"),
                    ("Customer special instructions display on ticket", "task", "medium", "done", "Restaurant App"),
                    ("Photo upload for each menu item", "task", "medium", "done", "Restaurant App"),
                    ("Restaurant analytics — top dishes chart", "task", "low", "done", "Analytics"),
                    ("Order history with filter and export", "task", "low", "done", "Restaurant App"),
                    ("Loyalty points issuance to customers", "task", "medium", "review", "Payments"),
                    ("Bug: prep time update doesn't reflect on customer ETA", "bug", "high", "done", "Restaurant App"),
                    ("Print receipt via thermal printer API", "task", "medium", "done", "Restaurant App"),
                    ("Negative feedback alert to restaurant owner", "task", "medium", "done", "Notifications"),
                    ("Multi-branch restaurant management", "task", "high", "done", "Restaurant App"),
                    ("Commission statement PDF download", "task", "low", "done", "Restaurant App"),
                    ("Aggregated menu search index rebuild on save", "task", "high", "done", "Search & Menu"),
                    ("Restaurant tablet app APK build pipeline", "task", "medium", "done", "Restaurant App"),
                ],
            },
            {
                "name": "QBITE Sprint 4 — Delivery Agent App",
                "status": "active",
                "offset": -2, "length": 2,
                "issues": [
                    ("Agent registration and document upload", "task", "high", "done", "Delivery Agent"),
                    ("Agent location broadcast via WebSocket", "task", "critical", "in_progress", "Delivery Agent"),
                    ("Order assignment algorithm (nearest agent)", "task", "critical", "in_progress", "Delivery Agent"),
                    ("Bug: agent goes offline when app minimised", "bug", "critical", "in_progress", "Delivery Agent"),
                    ("Turn-by-turn navigation integration (Google Maps)", "task", "high", "in_progress", "Delivery Agent"),
                    ("Order pickup confirmation with OTP", "task", "high", "done", "Delivery Agent"),
                    ("Delivery proof photo upload", "task", "medium", "in_progress", "Delivery Agent"),
                    ("Agent earnings and payout dashboard", "task", "medium", "todo", "Delivery Agent"),
                    ("Incentive / bonus calculation engine", "task", "medium", "todo", "Payments"),
                    ("Bug: map not loading in low-network areas", "bug", "high", "todo", "Delivery Agent"),
                    ("Agent availability toggle (online/offline)", "task", "high", "done", "Delivery Agent"),
                    ("SOS emergency button for agent safety", "task", "medium", "todo", "Delivery Agent"),
                    ("Contactless delivery option flag", "task", "medium", "in_progress", "Delivery Agent"),
                    ("Agent rating by customer post-delivery", "task", "medium", "todo", "Delivery Agent"),
                    ("Real-time agent location shown to customer", "task", "critical", "in_progress", "Customer App"),
                    ("Delivery zone polygon configuration", "task", "medium", "todo", "Delivery Agent"),
                    ("Auto-assign timeout → reassign to next agent", "task", "high", "todo", "Delivery Agent"),
                    ("Agent support chat with ops team", "task", "low", "todo", "Notifications"),
                    ("Multi-order batching for single agent", "task", "high", "todo", "Delivery Agent"),
                    ("Heatmap: peak order zones for agent planning", "task", "low", "todo", "Analytics"),
                    ("Performance: location updates ≤ 2s latency", "task", "high", "todo", "Delivery Agent"),
                ],
            },
            {
                "name": "QBITE Sprint 5 — Notifications & Analytics",
                "status": "planned",
                "offset": 2, "length": 2,
                "issues": [
                    ("Push notifications: order status updates", "task", "critical", "todo", "Notifications"),
                    ("SMS fallback when push fails", "task", "high", "todo", "Notifications"),
                    ("In-app notification centre", "task", "medium", "todo", "Notifications"),
                    ("Abandoned cart push notification", "task", "high", "todo", "Notifications"),
                    ("Promotional campaign notification scheduling", "task", "medium", "todo", "Notifications"),
                    ("Restaurant peak hour demand forecast", "task", "high", "todo", "Analytics"),
                    ("Customer cohort retention report", "task", "medium", "todo", "Analytics"),
                    ("Average order value trend dashboard", "task", "medium", "todo", "Analytics"),
                    ("Bug: notification delivered twice on reconnect", "bug", "high", "todo", "Notifications"),
                    ("Personalised dish recommendations (ML)", "task", "high", "todo", "Search & Menu"),
                    ("Weekly digest email for restaurant owners", "task", "low", "todo", "Notifications"),
                    ("Customer lifetime value (CLV) report", "task", "medium", "todo", "Analytics"),
                    ("Delivery time accuracy report", "task", "medium", "todo", "Analytics"),
                    ("Surge pricing analytics dashboard", "task", "medium", "todo", "Analytics"),
                    ("NPS survey post-delivery", "task", "low", "todo", "Customer App"),
                    ("Churn prediction model for customers", "task", "high", "todo", "Analytics"),
                    ("Agent utilisation rate heatmap", "task", "medium", "todo", "Analytics"),
                    ("Food category trend analysis", "task", "low", "todo", "Analytics"),
                    ("A/B test framework for promotions", "task", "high", "todo", "Analytics"),
                    ("Notification opt-out preference centre", "task", "medium", "todo", "Notifications"),
                    ("Real-time operational dashboard (ops team)", "task", "high", "todo", "Analytics"),
                ],
            },
        ],
        "backlog": [
            ("Subscription meal plan feature", "task", "medium", "Customer App"),
            ("Group ordering for offices", "task", "medium", "Customer App"),
            ("Voice ordering integration (Alexa / Google)", "task", "low", "Customer App"),
            ("Restaurant loyalty card digital integration", "task", "medium", "Restaurant App"),
            ("Hyperlocal advertising platform for restaurants", "task", "low", "Analytics"),
            ("Multi-language support (Hindi, Tamil, Telugu)", "task", "medium", "Customer App"),
            ("Agent bike insurance integration", "task", "low", "Delivery Agent"),
            ("QR code table ordering for dine-in", "task", "medium", "Restaurant App"),
            ("Bug: search results stale after menu update", "bug", "medium", "Search & Menu"),
            ("Dark kitchen (cloud kitchen) management module", "task", "high", "Restaurant App"),
        ],
        "wiki_pages": [
            ("QuickBite Product Overview", "# QuickBite\n\nQuickBite is an on-demand food delivery platform connecting hungry customers with the best local restaurants, powered by a smart delivery network.\n\n## Apps\n- **Customer App** (iOS + Android + Web)\n- **Restaurant Dashboard** (Web + Tablet)\n- **Delivery Agent App** (Android)\n\n## Core Flow\n`Customer orders → Restaurant accepts → Kitchen preps → Agent picks up → Delivered`", None),
            ("Order Lifecycle", "# Order Lifecycle\n\n## States\n```\nplaced → confirmed → preparing → ready_for_pickup → picked_up → delivered\n                                                               └→ cancelled\n```\n\n## SLA Targets\n| Stage           | Target     |\n|-----------------|------------|\n| Restaurant confirm | < 2 min |\n| Prep time       | 15–25 min  |\n| Delivery time   | < 40 min   |\n| Total ETA       | < 60 min   |", None),
            ("Surge Pricing Algorithm", "# Surge Pricing\n\nQuickBite applies surge pricing when demand-supply ratio exceeds threshold.\n\n## Formula\n```\nsurge_multiplier = min(3.0, 1.0 + (demand/supply - 1) * 0.5)\n```\n\n## Trigger Conditions\n- Active orders > 1.5× available agents in zone\n- Weather event detected (rain, storm)\n- Festival / public holiday\n\nSurge is displayed prominently to customer before checkout.", None),
            ("Restaurant Onboarding Checklist", "# Restaurant Onboarding\n\n## Documents Required\n- FSSAI Food Licence\n- GST Registration Certificate\n- Bank Account Details\n- Menu with photos and prices\n- Restaurant photos (interior + exterior)\n\n## Go-Live Checklist\n- [ ] Menu approved by QuickBite team\n- [ ] Tablet delivered and configured\n- [ ] Test order placed and fulfilled\n- [ ] Commission agreement signed", None),
        ],
    },

    # ── Project 3: RideFlow — Cab Service App ─────────────────────────────────
    {
        "key":   "RIDE",
        "name":  "RideFlow",
        "desc":  "Real-time cab hailing service with dynamic pricing, multi-vehicle categories, and in-app safety features.",
        "pm":    pms[2],
        "devs":  devs[1:5],
        "viewers": viewers[2:4],
        "labels": [
            ("Rider App",      "#F97316"),
            ("Driver App",     "#3B82F6"),
            ("Pricing Engine", "#EF4444"),
            ("Maps & Routing", "#10B981"),
            ("Safety",         "#8B5CF6"),
            ("Payments",       "#F59E0B"),
            ("Analytics",      "#06B6D4"),
        ],
        "sprints": [
            {
                "name": "RIDE Sprint 1 — Rider App Core",
                "status": "completed",
                "offset": -10, "length": 2,
                "issues": [
                    ("Rider registration with phone OTP", "task", "critical", "done", "Rider App"),
                    ("Home screen with pickup location auto-detect", "task", "high", "done", "Maps & Routing"),
                    ("Destination search with Google Places autocomplete", "task", "high", "done", "Maps & Routing"),
                    ("Vehicle category selection (Mini, Sedan, SUV)", "task", "high", "done", "Rider App"),
                    ("Fare estimate before booking", "task", "critical", "done", "Pricing Engine"),
                    ("Bug: pickup location snaps to wrong road segment", "bug", "critical", "done", "Maps & Routing"),
                    ("Ride booking and driver matching screen", "task", "high", "done", "Rider App"),
                    ("Driver ETA display on map", "task", "high", "done", "Maps & Routing"),
                    ("Ride cancellation with reason selection", "task", "medium", "done", "Rider App"),
                    ("Driver profile card (photo, rating, vehicle)", "task", "medium", "done", "Rider App"),
                    ("In-app call / masked call to driver", "task", "high", "done", "Safety"),
                    ("Post-ride rating for driver", "task", "medium", "done", "Rider App"),
                    ("Ride history list with receipt", "task", "medium", "done", "Rider App"),
                    ("Bug: ETa countdown resets on screen rotate", "bug", "medium", "done", "Rider App"),
                    ("Scheduled ride booking (book in advance)", "task", "medium", "done", "Rider App"),
                    ("Promo code and referral system", "task", "medium", "done", "Payments"),
                    ("Accessibility: voiceover support on iOS", "task", "medium", "done", "Rider App"),
                    ("Dark mode for rider app", "task", "low", "done", "Rider App"),
                    ("Ride sharing / pool option", "task", "medium", "done", "Rider App"),
                    ("Emergency SOS button", "task", "critical", "done", "Safety"),
                    ("Unit tests for fare calculation service", "task", "high", "done", "Pricing Engine"),
                ],
            },
            {
                "name": "RIDE Sprint 2 — Driver App & Matching",
                "status": "completed",
                "offset": -8, "length": 2,
                "issues": [
                    ("Driver registration and document verification", "task", "critical", "done", "Driver App"),
                    ("Driver online/offline toggle", "task", "high", "done", "Driver App"),
                    ("Incoming ride request notification", "task", "critical", "done", "Driver App"),
                    ("Accept/decline ride with 15s timer", "task", "high", "done", "Driver App"),
                    ("Navigation to pickup point", "task", "high", "done", "Maps & Routing"),
                    ("Bug: ride request sound not playing on Android 13", "bug", "high", "done", "Driver App"),
                    ("Arrival at pickup confirmation button", "task", "medium", "done", "Driver App"),
                    ("Start ride — OTP verification by rider", "task", "high", "done", "Safety"),
                    ("En-route navigation to destination", "task", "high", "done", "Maps & Routing"),
                    ("End ride and fare display", "task", "critical", "done", "Driver App"),
                    ("Driver earnings dashboard", "task", "medium", "done", "Driver App"),
                    ("Driver rating display in profile", "task", "medium", "done", "Driver App"),
                    ("Ride matching algorithm — proximity + rating", "task", "critical", "done", "Driver App"),
                    ("Bug: driver matched to ride 8 km away despite closer driver available", "bug", "critical", "done", "Driver App"),
                    ("Trip dispatch queue management", "task", "high", "done", "Driver App"),
                    ("Driver incentive / streak bonus engine", "task", "medium", "done", "Payments"),
                    ("Driver document expiry alert (licence, insurance)", "task", "medium", "done", "Driver App"),
                    ("Driver support ticket system", "task", "low", "done", "Driver App"),
                    ("Performance: matching latency < 500ms", "task", "high", "done", "Driver App"),
                    ("Load test: 1000 concurrent ride requests", "task", "high", "done", "Driver App"),
                    ("Driver app battery-optimised location updates", "task", "high", "done", "Maps & Routing"),
                ],
            },
            {
                "name": "RIDE Sprint 3 — Dynamic Pricing",
                "status": "completed",
                "offset": -6, "length": 2,
                "issues": [
                    ("Base fare + per-km + per-minute formula", "task", "critical", "done", "Pricing Engine"),
                    ("Surge multiplier based on supply/demand zone", "task", "critical", "done", "Pricing Engine"),
                    ("Peak-hour pricing schedule config UI", "task", "high", "done", "Pricing Engine"),
                    ("Bug: surge not applied to pre-scheduled rides", "bug", "high", "done", "Pricing Engine"),
                    ("Fare breakdown screen for rider (base+surge+tax)", "task", "medium", "done", "Pricing Engine"),
                    ("Toll auto-addition via map waypoint", "task", "high", "done", "Maps & Routing"),
                    ("Airport surcharge zone polygon config", "task", "medium", "done", "Pricing Engine"),
                    ("Night-time premium (10 PM – 6 AM)", "task", "medium", "done", "Pricing Engine"),
                    ("Long-distance rate slab configuration", "task", "medium", "done", "Pricing Engine"),
                    ("Waiting time charge after 3-minute grace", "task", "high", "done", "Pricing Engine"),
                    ("Cancellation fee logic (after driver arrives)", "task", "high", "done", "Pricing Engine"),
                    ("Bug: cancellation fee charged even when driver cancelled", "bug", "critical", "done", "Pricing Engine"),
                    ("Corporate account flat-rate override", "task", "medium", "done", "Pricing Engine"),
                    ("Price lock for pre-scheduled rides", "task", "medium", "done", "Pricing Engine"),
                    ("Pricing A/B test framework", "task", "high", "done", "Analytics"),
                    ("Fare prediction model for 1-hour forecast", "task", "high", "done", "Pricing Engine"),
                    ("Minimum fare enforcement per vehicle category", "task", "medium", "done", "Pricing Engine"),
                    ("GST calculation on fare (5% for cab)", "task", "high", "done", "Payments"),
                    ("Pricing rule admin panel (CRUD)", "task", "medium", "done", "Pricing Engine"),
                    ("Integration test: surge + toll + night premium combined", "task", "high", "done", "Pricing Engine"),
                    ("Pricing audit log for dispute resolution", "task", "medium", "done", "Pricing Engine"),
                ],
            },
            {
                "name": "RIDE Sprint 4 — Safety Features",
                "status": "active",
                "offset": -2, "length": 2,
                "issues": [
                    ("Share live trip with trusted contacts", "task", "critical", "in_progress", "Safety"),
                    ("SOS alert → nearest police station + emergency contact", "task", "critical", "in_progress", "Safety"),
                    ("Route deviation detection and alert", "task", "critical", "todo", "Safety"),
                    ("Bug: SOS button unresponsive during active call", "bug", "critical", "in_progress", "Safety"),
                    ("Masked call to driver (no number exposed)", "task", "high", "done", "Safety"),
                    ("Ride OTP — 4-digit code to start ride", "task", "high", "done", "Safety"),
                    ("Driver selfie check (liveness at shift start)", "task", "high", "in_progress", "Safety"),
                    ("Rider photo verification option", "task", "medium", "todo", "Safety"),
                    ("Fake booking detection (ML anomaly)", "task", "high", "todo", "Safety"),
                    ("Trip recording (audio) with consent", "task", "medium", "todo", "Safety"),
                    ("Speed limit alert to driver (> 80 km/h)", "task", "high", "in_progress", "Safety"),
                    ("Accident detection via accelerometer", "task", "high", "todo", "Safety"),
                    ("Insurance claim initiation in-app", "task", "medium", "todo", "Safety"),
                    ("Night ride safety checklist for driver", "task", "medium", "todo", "Safety"),
                    ("Bug: share trip link expires before ride ends", "bug", "high", "todo", "Safety"),
                    ("Safety score for drivers (composite metric)", "task", "medium", "todo", "Safety"),
                    ("Panic button hardware integration (partner devices)", "task", "low", "todo", "Safety"),
                    ("Geofencing: alert when ride leaves city limits", "task", "medium", "todo", "Maps & Routing"),
                    ("Driver fatigue detection (shift hours alert)", "task", "medium", "todo", "Safety"),
                    ("Safety incident report form for rider", "task", "high", "in_progress", "Safety"),
                    ("Safety dashboard for ops team", "task", "high", "todo", "Analytics"),
                ],
            },
            {
                "name": "RIDE Sprint 5 — Corporate & Analytics",
                "status": "planned",
                "offset": 2, "length": 2,
                "issues": [
                    ("Corporate account dashboard", "task", "high", "todo", "Analytics"),
                    ("Employee ride booking with cost centre tagging", "task", "high", "todo", "Rider App"),
                    ("Monthly invoice generation for corporate", "task", "high", "todo", "Payments"),
                    ("Expense report export (PDF / CSV)", "task", "medium", "todo", "Analytics"),
                    ("Corporate admin — manage employees & limits", "task", "high", "todo", "Rider App"),
                    ("Ride policy enforcement (only work hours)", "task", "medium", "todo", "Rider App"),
                    ("Driver performance scorecard report", "task", "medium", "todo", "Analytics"),
                    ("Zone-level supply-demand heatmap", "task", "medium", "todo", "Analytics"),
                    ("Peak hour demand forecast (next 4 hours)", "task", "high", "todo", "Analytics"),
                    ("Revenue per zone dashboard", "task", "medium", "todo", "Analytics"),
                    ("Bug: corporate booking not applying flat rate", "bug", "high", "todo", "Pricing Engine"),
                    ("Cancellation rate by zone and time report", "task", "medium", "todo", "Analytics"),
                    ("Driver churn prediction model", "task", "high", "todo", "Analytics"),
                    ("Customer lifetime value analysis", "task", "medium", "todo", "Analytics"),
                    ("SSO integration for corporate login (SAML)", "task", "high", "todo", "Rider App"),
                    ("Compliance report: driver document expiry audit", "task", "medium", "todo", "Driver App"),
                    ("EV fleet support — charging station waypoints", "task", "low", "todo", "Maps & Routing"),
                    ("Wheelchair-accessible vehicle category", "task", "medium", "todo", "Rider App"),
                    ("Multi-city expansion config panel", "task", "high", "todo", "Analytics"),
                    ("Automated driver incentive payout via NEFT", "task", "high", "todo", "Payments"),
                    ("Data retention and GDPR purge workflow", "task", "medium", "todo", "Analytics"),
                ],
            },
        ],
        "backlog": [
            ("Intercity ride booking module", "task", "medium", "Rider App"),
            ("Bike taxi category support", "task", "medium", "Rider App"),
            ("EV vehicle category with charging station integration", "task", "low", "Maps & Routing"),
            ("Driver gamification (badges, leaderboard)", "task", "low", "Driver App"),
            ("Rental package (hourly hire) mode", "task", "medium", "Pricing Engine"),
            ("Ride concierge for airport pickups", "task", "medium", "Rider App"),
            ("Multi-language driver app (Hindi, Kannada, Tamil)", "task", "medium", "Driver App"),
            ("Carbon offset option at checkout", "task", "low", "Payments"),
            ("AI chatbot for rider support", "task", "high", "Safety"),
            ("Driver marketplace for vehicle leasing", "task", "low", "Driver App"),
        ],
        "wiki_pages": [
            ("RideFlow Product Overview", "# RideFlow\n\nRideFlow is a real-time cab hailing platform offering Mini, Sedan, SUV, and Bike Taxi categories across tier-1 and tier-2 cities.\n\n## Key Differentiators\n- Sub-500ms driver matching\n- Industry-leading safety feature set\n- Dynamic pricing with full fare transparency\n- Corporate accounts with policy enforcement", None),
            ("Driver Onboarding Process", "# Driver Onboarding\n\n## Required Documents\n- Aadhaar Card\n- PAN Card\n- Driving Licence (valid)\n- Vehicle Registration Certificate\n- Vehicle Insurance (comprehensive)\n- Police Clearance Certificate\n- Fitness Certificate\n\n## Verification Steps\n1. Document upload via Driver App\n2. Automated OCR extraction + manual review\n3. Background check (3–5 business days)\n4. Vehicle inspection at nearest hub\n5. Training video + quiz (mandatory)\n6. Account activated", None),
            ("Dynamic Pricing Rules", "# Dynamic Pricing\n\n## Base Fare Structure\n| Category | Base | Per km | Per min |\n|----------|------|--------|---------|\n| Mini     | ₹30  | ₹8     | ₹1      |\n| Sedan    | ₹50  | ₹12    | ₹1.5    |\n| SUV      | ₹80  | ₹18    | ₹2      |\n\n## Surge Zones\nCity is divided into H3 hexagon zones (resolution 7). Surge multiplier calculated per zone every 2 minutes.", None),
            ("Safety Protocols", "# Safety at RideFlow\n\n## Rider Safety\n- Share live trip link with up to 5 contacts\n- SOS button triggers automated call to emergency services\n- All calls routed through masked number service\n- Route deviation alert within 300m\n\n## Driver Safety\n- Fatigue alert after 10 consecutive hours online\n- Speed alert at > 80 km/h sustained for 30s\n- Night ride safety checklist before first ride after 10 PM", None),
        ],
    },

    # ── Project 4: StayEase — Hotel Booking Platform ──────────────────────────
    {
        "key":   "STAY",
        "name":  "StayEase",
        "desc":  "Hotel and short-stay booking platform with real-time availability, dynamic pricing, and property management tools.",
        "pm":    pms[3],
        "devs":  devs[4:],
        "viewers": viewers[3:],
        "labels": [
            ("Search & Discovery", "#F97316"),
            ("Booking Engine",    "#3B82F6"),
            ("Payments",          "#EF4444"),
            ("Property Portal",   "#10B981"),
            ("Reviews",           "#8B5CF6"),
            ("Notifications",     "#F59E0B"),
            ("Analytics",         "#06B6D4"),
        ],
        "sprints": [
            {
                "name": "STAY Sprint 1 — Search & Discovery",
                "status": "completed",
                "offset": -10, "length": 2,
                "issues": [
                    ("Hotel search by city and check-in/out dates", "task", "critical", "done", "Search & Discovery"),
                    ("Map view for hotel results", "task", "high", "done", "Search & Discovery"),
                    ("Filter: price range, rating, amenities", "task", "high", "done", "Search & Discovery"),
                    ("Room type listing with photos carousel", "task", "high", "done", "Search & Discovery"),
                    ("Bug: search returns stale availability on date change", "bug", "critical", "done", "Search & Discovery"),
                    ("Hotel detail page — amenities, policies, location", "task", "high", "done", "Search & Discovery"),
                    ("Autocomplete for city / landmark search", "task", "medium", "done", "Search & Discovery"),
                    ("Nearby attractions widget on hotel page", "task", "low", "done", "Search & Discovery"),
                    ("Sort: price low-high, rating, distance", "task", "medium", "done", "Search & Discovery"),
                    ("Hotel photo gallery with zoom", "task", "medium", "done", "Search & Discovery"),
                    ("Virtual tour embed (Matterport link)", "task", "low", "done", "Search & Discovery"),
                    ("Deal badge — last 2 rooms, limited-time offer", "task", "medium", "done", "Search & Discovery"),
                    ("Wishlist / saved hotels", "task", "medium", "done", "Search & Discovery"),
                    ("Bug: map pins cluster incorrectly at zoom level 12", "bug", "medium", "done", "Search & Discovery"),
                    ("Mobile-first responsive hotel card design", "task", "high", "done", "Search & Discovery"),
                    ("Accessibility: WCAG 2.1 AA compliance for search", "task", "medium", "done", "Search & Discovery"),
                    ("Hotel comparison tool (side-by-side, 3 hotels)", "task", "medium", "done", "Search & Discovery"),
                    ("Recently viewed hotels section", "task", "low", "done", "Search & Discovery"),
                    ("Breadcrumb navigation for drill-down search", "task", "low", "done", "Search & Discovery"),
                    ("Performance: search results < 1.5s for 10k hotels", "task", "high", "done", "Search & Discovery"),
                    ("SEO: server-side rendered hotel pages", "task", "high", "done", "Search & Discovery"),
                ],
            },
            {
                "name": "STAY Sprint 2 — Booking Engine",
                "status": "completed",
                "offset": -8, "length": 2,
                "issues": [
                    ("Room availability calendar API", "task", "critical", "done", "Booking Engine"),
                    ("Real-time inventory lock on room selection", "task", "critical", "done", "Booking Engine"),
                    ("Guest details form with validation", "task", "high", "done", "Booking Engine"),
                    ("Add-on services at checkout (breakfast, airport transfer)", "task", "medium", "done", "Booking Engine"),
                    ("Bug: double booking on concurrent requests", "bug", "critical", "done", "Booking Engine"),
                    ("Booking confirmation email with PDF voucher", "task", "high", "done", "Booking Engine"),
                    ("Booking modification — change dates/room", "task", "high", "done", "Booking Engine"),
                    ("Cancellation policy display and enforcement", "task", "high", "done", "Booking Engine"),
                    ("Free cancellation badge on eligible rooms", "task", "medium", "done", "Booking Engine"),
                    ("Group booking (multiple rooms, one reservation)", "task", "medium", "done", "Booking Engine"),
                    ("Corporate booking with PO number field", "task", "medium", "done", "Booking Engine"),
                    ("Bug: modification not updating room inventory correctly", "bug", "high", "done", "Booking Engine"),
                    ("Booking reference number generation", "task", "high", "done", "Booking Engine"),
                    ("Check-in time preference selection", "task", "low", "done", "Booking Engine"),
                    ("Special requests free-text field", "task", "low", "done", "Booking Engine"),
                    ("Multi-night rate blending logic", "task", "high", "done", "Booking Engine"),
                    ("Channel manager integration (Booking.com, Expedia)", "task", "critical", "done", "Booking Engine"),
                    ("OTA parity rate enforcement check", "task", "medium", "done", "Booking Engine"),
                    ("Waitlist for fully-booked properties", "task", "medium", "done", "Booking Engine"),
                    ("Integration test: full booking lifecycle", "task", "high", "done", "Booking Engine"),
                    ("Load test: 500 concurrent bookings", "task", "high", "done", "Booking Engine"),
                ],
            },
            {
                "name": "STAY Sprint 3 — Payments & Pricing",
                "status": "completed",
                "offset": -6, "length": 2,
                "issues": [
                    ("Credit/debit card payment via Stripe", "task", "critical", "done", "Payments"),
                    ("Net banking and UPI options", "task", "high", "done", "Payments"),
                    ("Pay-at-hotel (hold) option", "task", "high", "done", "Payments"),
                    ("Partial payment — 20% now, rest at check-in", "task", "medium", "done", "Payments"),
                    ("Bug: refund not initiated on system cancellation", "bug", "critical", "done", "Payments"),
                    ("Currency conversion for international bookings", "task", "high", "done", "Payments"),
                    ("GST breakup on invoice (12% hotel tax)", "task", "high", "done", "Payments"),
                    ("Revenue management — dynamic pricing per season", "task", "critical", "done", "Booking Engine"),
                    ("Yield management: fill-or-discount last rooms", "task", "high", "done", "Booking Engine"),
                    ("Loyalty points earn on booking", "task", "medium", "done", "Payments"),
                    ("Loyalty points redeem at checkout", "task", "medium", "done", "Payments"),
                    ("Bug: loyalty points deducted but booking fails", "bug", "high", "done", "Payments"),
                    ("Coupon code application with stacking rules", "task", "medium", "done", "Payments"),
                    ("Corporate negotiated rate management", "task", "medium", "done", "Booking Engine"),
                    ("Early bird discount automation (60+ days in advance)", "task", "low", "done", "Booking Engine"),
                    ("Last-minute deal trigger (< 24h before check-in)", "task", "medium", "done", "Booking Engine"),
                    ("Payment gateway fallback (Stripe → Razorpay)", "task", "high", "done", "Payments"),
                    ("3DS authentication handling", "task", "high", "done", "Payments"),
                    ("Refund timeline tracker for guest", "task", "medium", "done", "Payments"),
                    ("Finance dashboard: daily revenue, refunds, GMV", "task", "medium", "done", "Analytics"),
                    ("Tax compliance report by state", "task", "medium", "done", "Analytics"),
                ],
            },
            {
                "name": "STAY Sprint 4 — Property Management Portal",
                "status": "active",
                "offset": -2, "length": 2,
                "issues": [
                    ("Property onboarding wizard (multi-step)", "task", "high", "done", "Property Portal"),
                    ("Room type and rate plan configuration", "task", "critical", "in_progress", "Property Portal"),
                    ("Availability calendar management (block/unblock)", "task", "critical", "in_progress", "Property Portal"),
                    ("Bug: blocked dates still showing available in search", "bug", "critical", "in_progress", "Property Portal"),
                    ("Reservation management dashboard", "task", "high", "done", "Property Portal"),
                    ("Guest check-in / check-out management", "task", "high", "in_progress", "Property Portal"),
                    ("Housekeeping task assignment system", "task", "medium", "todo", "Property Portal"),
                    ("Maintenance request tracking", "task", "medium", "todo", "Property Portal"),
                    ("Property photo and description management", "task", "medium", "done", "Property Portal"),
                    ("Seasonal rate plans (summer, winter, peak)", "task", "high", "in_progress", "Property Portal"),
                    ("Minimum stay restriction configuration", "task", "medium", "todo", "Property Portal"),
                    ("Channel manager sync status dashboard", "task", "high", "in_progress", "Property Portal"),
                    ("Bug: OTA sync fails silently on rate plan change", "bug", "high", "todo", "Property Portal"),
                    ("Property revenue report (MTD, YTD)", "task", "medium", "todo", "Analytics"),
                    ("Occupancy rate chart by room type", "task", "medium", "todo", "Analytics"),
                    ("Guest feedback summary for property manager", "task", "medium", "todo", "Reviews"),
                    ("Cancellation report and reason analysis", "task", "low", "todo", "Analytics"),
                    ("Staff account management for property", "task", "medium", "todo", "Property Portal"),
                    ("Notification: new booking / cancellation alert", "task", "high", "in_progress", "Notifications"),
                    ("Property API: channel manager webhook endpoint", "task", "high", "in_progress", "Property Portal"),
                    ("Automated review request email post-checkout", "task", "medium", "todo", "Reviews"),
                ],
            },
            {
                "name": "STAY Sprint 5 — Reviews & Analytics",
                "status": "planned",
                "offset": 2, "length": 2,
                "issues": [
                    ("Guest review submission (post-checkout only)", "task", "high", "todo", "Reviews"),
                    ("Review moderation workflow for ops team", "task", "medium", "todo", "Reviews"),
                    ("Property response to review feature", "task", "medium", "todo", "Reviews"),
                    ("Review aggregation: overall + category scores", "task", "high", "todo", "Reviews"),
                    ("Bug: review submitted twice on slow connection", "bug", "medium", "todo", "Reviews"),
                    ("Verified stay badge on reviews", "task", "medium", "todo", "Reviews"),
                    ("Revenue analytics: ADR, RevPAR, occupancy", "task", "high", "todo", "Analytics"),
                    ("Booking source attribution report (direct vs OTA)", "task", "high", "todo", "Analytics"),
                    ("Cancellation rate and lost revenue report", "task", "medium", "todo", "Analytics"),
                    ("Market benchmarking dashboard (vs comp set)", "task", "high", "todo", "Analytics"),
                    ("Demand forecast (next 30/60/90 days)", "task", "high", "todo", "Analytics"),
                    ("Price recommendation engine (ML)", "task", "high", "todo", "Analytics"),
                    ("Customer segmentation: business vs leisure", "task", "medium", "todo", "Analytics"),
                    ("Cohort retention — repeat guest rate", "task", "medium", "todo", "Analytics"),
                    ("NPS tracking over time", "task", "medium", "todo", "Analytics"),
                    ("Tax summary report for GST filing", "task", "high", "todo", "Analytics"),
                    ("Property performance league table", "task", "low", "todo", "Analytics"),
                    ("Review sentiment analysis (NLP)", "task", "medium", "todo", "Reviews"),
                    ("Email: weekly property performance digest", "task", "low", "todo", "Notifications"),
                    ("Executive travel dashboard for corporate accounts", "task", "medium", "todo", "Analytics"),
                    ("Booking attribution: last-click vs multi-touch", "task", "medium", "todo", "Analytics"),
                ],
            },
        ],
        "backlog": [
            ("Airbnb-style home and villa listings", "task", "medium", "Property Portal"),
            ("Long-stay monthly rate plans", "task", "medium", "Booking Engine"),
            ("Digital check-in with QR room key", "task", "high", "Booking Engine"),
            ("Concierge chatbot for guest requests", "task", "medium", "Property Portal"),
            ("Loyalty programme tier (Silver, Gold, Platinum)", "task", "medium", "Payments"),
            ("Property management API for PMS integrations", "task", "high", "Property Portal"),
            ("Multi-currency payout to property owners", "task", "medium", "Payments"),
            ("Accessibility rating and filter (wheelchair, elevator)", "task", "medium", "Search & Discovery"),
            ("Pet-friendly filter and policy display", "task", "low", "Search & Discovery"),
            ("Bug: review score not updating after new reviews", "bug", "medium", "Reviews"),
        ],
        "wiki_pages": [
            ("StayEase Platform Overview", "# StayEase\n\nStayEase is a full-stack hotel and short-stay booking platform covering the complete journey from search to checkout, with a robust property management portal for hoteliers.\n\n## User Types\n- **Guests** — search, book, review\n- **Property Managers** — manage rooms, rates, and reservations\n- **StayEase Ops** — moderation, compliance, analytics", None),
            ("Booking Lifecycle", "# Booking Lifecycle\n\n```\nsearched → room_selected → details_filled → payment_attempted\n    → confirmed → checked_in → checked_out → review_requested\n```\n\n## Cancellation States\n- `pending_refund` — refund queued\n- `refunded` — amount returned\n- `no_refund` — within non-refundable window", None),
            ("Revenue Management Guide", "# Revenue Management\n\n## Key Metrics\n- **ADR** (Average Daily Rate) = Total Room Revenue / Rooms Sold\n- **Occupancy Rate** = Rooms Sold / Rooms Available\n- **RevPAR** = ADR × Occupancy Rate\n\n## Dynamic Pricing Levers\n1. Seasonal rate plans (3–5 per property)\n2. Day-of-week variations\n3. Last-minute discount trigger\n4. Early-bird discount (60+ days)\n5. Yield-based discount for fill-up", None),
            ("Property Onboarding SOP", "# Property Onboarding\n\n## Required Information\n- Hotel name, address, GPS coordinates\n- Star rating / property type\n- Room types with photos and capacities\n- Base rate plans (BAR, Corporate, Advance)\n- Cancellation policies\n- Tax rates applicable (GST, luxury tax, tourist tax)\n\n## Channel Manager Setup\n1. Generate CM API key from StayEase portal\n2. Configure in hotel's PMS (Opera, IDS, etc.)\n3. Test with 5 availability updates\n4. Go live with rate push", None),
        ],
    },

    # ── Project 5: LearnHub — Online Learning Platform ────────────────────────
    {
        "key":   "LHUB",
        "name":  "LearnHub",
        "desc":  "Online learning management system (LMS) for corporate training, with course creation, progress tracking, certifications, and live sessions.",
        "pm":    pms[0],
        "devs":  devs[:4],
        "viewers": viewers[:2],
        "labels": [
            ("Course Builder",    "#F97316"),
            ("Learner Portal",    "#3B82F6"),
            ("Live Sessions",     "#10B981"),
            ("Assessments",       "#EF4444"),
            ("Certifications",    "#8B5CF6"),
            ("Analytics",         "#F59E0B"),
            ("Integrations",      "#06B6D4"),
        ],
        "sprints": [
            {
                "name": "LHUB Sprint 1 — Course Builder",
                "status": "completed",
                "offset": -10, "length": 2,
                "issues": [
                    ("Course creation wizard (title, description, category)", "task", "high", "done", "Course Builder"),
                    ("Lesson editor with rich text (TipTap)", "task", "high", "done", "Course Builder"),
                    ("Video lesson upload and HLS transcoding", "task", "critical", "done", "Course Builder"),
                    ("PDF and document lesson type support", "task", "medium", "done", "Course Builder"),
                    ("Bug: video upload fails for files > 2 GB", "bug", "critical", "done", "Course Builder"),
                    ("Course section and lesson drag-and-drop ordering", "task", "medium", "done", "Course Builder"),
                    ("Course thumbnail upload", "task", "low", "done", "Course Builder"),
                    ("Course preview mode for instructors", "task", "medium", "done", "Course Builder"),
                    ("Draft / published state toggle", "task", "high", "done", "Course Builder"),
                    ("Course duplication for reuse", "task", "low", "done", "Course Builder"),
                    ("Learning objectives checklist per course", "task", "medium", "done", "Course Builder"),
                    ("Course tagging and category taxonomy", "task", "medium", "done", "Course Builder"),
                    ("Bug: lesson order resets after page refresh", "bug", "high", "done", "Course Builder"),
                    ("Co-instructor collaboration on course", "task", "medium", "done", "Course Builder"),
                    ("Version history for course content", "task", "medium", "done", "Course Builder"),
                    ("Bulk lesson import from PowerPoint/PDF", "task", "medium", "done", "Course Builder"),
                    ("Caption/subtitle upload for video lessons", "task", "medium", "done", "Course Builder"),
                    ("Course access expiry date setting", "task", "low", "done", "Course Builder"),
                    ("SCORM 1.2 / xAPI content import", "task", "high", "done", "Integrations"),
                    ("Course builder keyboard shortcuts", "task", "low", "done", "Course Builder"),
                    ("Unit tests for course publishing service", "task", "medium", "done", "Course Builder"),
                ],
            },
            {
                "name": "LHUB Sprint 2 — Learner Portal",
                "status": "completed",
                "offset": -8, "length": 2,
                "issues": [
                    ("Learner registration and SSO (SAML/OAuth)", "task", "critical", "done", "Learner Portal"),
                    ("My courses dashboard with progress bars", "task", "high", "done", "Learner Portal"),
                    ("Course catalogue with search and filter", "task", "high", "done", "Learner Portal"),
                    ("Video player with playback speed control", "task", "high", "done", "Learner Portal"),
                    ("Bug: video player loses position on mobile rotate", "bug", "high", "done", "Learner Portal"),
                    ("Resume lesson from last position", "task", "high", "done", "Learner Portal"),
                    ("Lesson completion marking (auto + manual)", "task", "medium", "done", "Learner Portal"),
                    ("Notes taking alongside video", "task", "medium", "done", "Learner Portal"),
                    ("Offline download for mobile app", "task", "medium", "done", "Learner Portal"),
                    ("Discussion forum per lesson", "task", "medium", "done", "Learner Portal"),
                    ("Learner profile and learning streak", "task", "low", "done", "Learner Portal"),
                    ("Search within course (full-text lesson search)", "task", "medium", "done", "Learner Portal"),
                    ("Bug: discussion replies not showing for new users", "bug", "medium", "done", "Learner Portal"),
                    ("Bookmarks for lessons", "task", "low", "done", "Learner Portal"),
                    ("Mobile app — iOS and Android", "task", "high", "done", "Learner Portal"),
                    ("Accessibility: WCAG 2.1 for video player", "task", "medium", "done", "Learner Portal"),
                    ("Multi-language content support (i18n)", "task", "medium", "done", "Learner Portal"),
                    ("Recommended courses based on role", "task", "medium", "done", "Learner Portal"),
                    ("Gamification: XP points and badges", "task", "low", "done", "Learner Portal"),
                    ("Leaderboard by department", "task", "low", "done", "Learner Portal"),
                    ("Performance: course load < 2s on 4G", "task", "high", "done", "Learner Portal"),
                ],
            },
            {
                "name": "LHUB Sprint 3 — Assessments & Certifications",
                "status": "completed",
                "offset": -6, "length": 2,
                "issues": [
                    ("Quiz builder — MCQ, true/false, short answer", "task", "critical", "done", "Assessments"),
                    ("Quiz time limit and attempt restriction", "task", "high", "done", "Assessments"),
                    ("Randomise question order per attempt", "task", "medium", "done", "Assessments"),
                    ("Bug: quiz score not saved if browser closed", "bug", "critical", "done", "Assessments"),
                    ("Auto-grade MCQ with explanation reveal", "task", "high", "done", "Assessments"),
                    ("Manual grading for short-answer questions", "task", "high", "done", "Assessments"),
                    ("Certificate template builder (PDF)", "task", "high", "done", "Certifications"),
                    ("Auto-issue certificate on course completion + passing score", "task", "critical", "done", "Certifications"),
                    ("Certificate verification URL (public link)", "task", "medium", "done", "Certifications"),
                    ("LinkedIn share for certificate", "task", "low", "done", "Certifications"),
                    ("Bug: certificate PDF shows wrong completion date", "bug", "high", "done", "Certifications"),
                    ("Certification expiry and renewal reminders", "task", "medium", "done", "Certifications"),
                    ("Competency mapping: skills per course/quiz", "task", "medium", "done", "Assessments"),
                    ("Assessment result analytics per question", "task", "medium", "done", "Analytics"),
                    ("Learner score distribution chart", "task", "medium", "done", "Analytics"),
                    ("Pass/fail threshold configuration per quiz", "task", "medium", "done", "Assessments"),
                    ("Question bank with tagging", "task", "medium", "done", "Assessments"),
                    ("Anti-cheat: tab-switch detection during quiz", "task", "high", "done", "Assessments"),
                    ("Bulk certificate download (zip) for admin", "task", "low", "done", "Certifications"),
                    ("External certification record upload by learner", "task", "low", "done", "Certifications"),
                    ("Integration tests: quiz → grade → certificate chain", "task", "high", "done", "Assessments"),
                ],
            },
            {
                "name": "LHUB Sprint 4 — Live Sessions",
                "status": "active",
                "offset": -2, "length": 2,
                "issues": [
                    ("Live session scheduling (Zoom / MS Teams embed)", "task", "high", "done", "Live Sessions"),
                    ("Live session registration and capacity limits", "task", "high", "in_progress", "Live Sessions"),
                    ("Calendar invite (.ics) on registration", "task", "medium", "in_progress", "Live Sessions"),
                    ("Bug: timezone display wrong for international learners", "bug", "high", "in_progress", "Live Sessions"),
                    ("Live session recording and auto-publish as lesson", "task", "high", "todo", "Live Sessions"),
                    ("Attendance tracking for live sessions", "task", "high", "in_progress", "Live Sessions"),
                    ("In-session poll and Q&A tool", "task", "medium", "todo", "Live Sessions"),
                    ("Waiting room before session starts", "task", "medium", "todo", "Live Sessions"),
                    ("Session feedback survey post-session", "task", "medium", "todo", "Live Sessions"),
                    ("Certificate for attending live session", "task", "medium", "todo", "Certifications"),
                    ("Bug: attendance not marked for late joiners (> 15 min)", "bug", "medium", "todo", "Live Sessions"),
                    ("Recurring live session series support", "task", "medium", "todo", "Live Sessions"),
                    ("Instructor virtual background for sessions", "task", "low", "todo", "Live Sessions"),
                    ("Live session analytics — attendance rate, engagement", "task", "medium", "todo", "Analytics"),
                    ("Breakout rooms support", "task", "medium", "todo", "Live Sessions"),
                    ("Notification: 24h and 1h reminders for sessions", "task", "high", "in_progress", "Live Sessions"),
                    ("Live session transcript (auto-generated)", "task", "medium", "todo", "Live Sessions"),
                    ("Session replay with chapter markers", "task", "medium", "todo", "Live Sessions"),
                    ("Multi-instructor co-host support", "task", "low", "todo", "Live Sessions"),
                    ("RTMP stream support for large audiences", "task", "high", "todo", "Live Sessions"),
                    ("Performance: 500 concurrent live session participants", "task", "high", "todo", "Live Sessions"),
                ],
            },
            {
                "name": "LHUB Sprint 5 — Analytics & Integrations",
                "status": "planned",
                "offset": 2, "length": 2,
                "issues": [
                    ("L&D dashboard: completion rates by department", "task", "high", "todo", "Analytics"),
                    ("Learner progress report (exportable)", "task", "high", "todo", "Analytics"),
                    ("Skills gap analysis report", "task", "high", "todo", "Analytics"),
                    ("Training compliance tracker (mandatory courses)", "task", "critical", "todo", "Analytics"),
                    ("ROI dashboard: training hours vs performance metrics", "task", "medium", "todo", "Analytics"),
                    ("Manager view: team learning dashboard", "task", "medium", "todo", "Analytics"),
                    ("HRMS integration (Workday, SAP SuccessFactors)", "task", "high", "todo", "Integrations"),
                    ("Slack / Teams bot: daily learning reminders", "task", "medium", "todo", "Integrations"),
                    ("Salesforce integration: link training to sales performance", "task", "medium", "todo", "Integrations"),
                    ("xAPI / TinCan statement push to LRS", "task", "high", "todo", "Integrations"),
                    ("Bug: HRMS sync drops users with special chars in name", "bug", "medium", "todo", "Integrations"),
                    ("Content marketplace API (Coursera, LinkedIn Learning)", "task", "high", "todo", "Integrations"),
                    ("White-label subdomain per corporate client", "task", "medium", "todo", "Integrations"),
                    ("Custom reporting with drag-and-drop builder", "task", "medium", "todo", "Analytics"),
                    ("Automated learning path assignment by role", "task", "high", "todo", "Learner Portal"),
                    ("Cohort-based learning program management", "task", "medium", "todo", "Learner Portal"),
                    ("Social learning: peer recommendation of courses", "task", "low", "todo", "Learner Portal"),
                    ("Content localisation workflow for L10n team", "task", "medium", "todo", "Course Builder"),
                    ("AI-powered course recommendation engine", "task", "high", "todo", "Learner Portal"),
                    ("Webhook API for completion events", "task", "medium", "todo", "Integrations"),
                    ("SOC 2 Type II compliance checklist", "task", "high", "todo", "Integrations"),
                ],
            },
        ],
        "backlog": [
            ("AI tutor chatbot for Q&A within courses", "task", "high", "Learner Portal"),
            ("VR/AR module support (WebXR)", "task", "low", "Course Builder"),
            ("Cohort-based bootcamp mode with cohort chat", "task", "medium", "Live Sessions"),
            ("Instructor marketplace for freelance trainers", "task", "medium", "Course Builder"),
            ("Adaptive learning paths (ML-driven)", "task", "high", "Learner Portal"),
            ("Microlearning nuggets (< 5-min lessons)", "task", "medium", "Course Builder"),
            ("Offline-first progressive web app (PWA)", "task", "medium", "Learner Portal"),
            ("Peer review and 360 assessment module", "task", "medium", "Assessments"),
            ("Bug: leaderboard rank shows wrong for tied XP scores", "bug", "medium", "Learner Portal"),
            ("LTI 1.3 consumer support for external tools", "task", "medium", "Integrations"),
        ],
        "wiki_pages": [
            ("LearnHub Platform Overview", "# LearnHub\n\nLearnHub is an enterprise-grade LMS enabling organisations to build, deliver, and track training programmes at scale.\n\n## Core Modules\n- **Course Builder** — Rich content creation with video, docs, SCORM\n- **Learner Portal** — Mobile-friendly consumption with offline support\n- **Assessments** — Quizzes, grading, competency mapping\n- **Certifications** — Auto-issued, verifiable certificates\n- **Live Sessions** — Zoom/Teams integration with attendance tracking\n- **Analytics** — L&D KPIs, compliance tracking, ROI", None),
            ("Course Creation Guidelines", "# Course Creation Guidelines\n\n## Structure Best Practices\n- Keep each lesson ≤ 10 minutes (video)\n- Use sections to group related lessons (5–8 lessons/section)\n- Include a quiz at the end of each section\n- Define at least 3 learning objectives per course\n\n## Content Standards\n- Video: 1080p minimum, MP4 (H.264), AAC audio\n- Subtitles: VTT format required for compliance\n- PDF: max 50 MB, text-searchable (not scanned)\n\n## Review Process\n1. Instructor submits for review\n2. L&D team reviews within 3 business days\n3. Approved → published to catalogue", None),
            ("Assessment Design Guide", "# Designing Effective Assessments\n\n## Question Types\n| Type | Auto-grade | Best for |\n|------|-----------|----------|\n| MCQ  | Yes       | Knowledge check |\n| True/False | Yes | Quick recall |\n| Short Answer | No | Application |\n| File Upload | No | Projects |\n\n## Pass Mark Policy\n- Default: 70%\n- Safety / Compliance courses: 80% minimum\n- Maximum 3 attempts before manager unlock required", None),
            ("Certification Policy", "# LearnHub Certification Policy\n\n## Certificate Issuance\nA certificate is auto-issued when:\n1. All lessons marked complete\n2. All mandatory quizzes passed (≥ pass threshold)\n3. Minimum 80% attendance if live sessions included\n\n## Validity\n- Certificates valid indefinitely unless course marked 'renew annually'\n- Renewal reminder sent 30 days before expiry\n\n## Verification\nEach certificate has a unique URL: `learnhub.io/verify/<uuid>`", None),
        ],
    },

    # ── Project 6: MediConnect — Healthcare Platform ──────────────────────────
    {
        "key":   "MEDI",
        "name":  "MediConnect",
        "desc":  "Digital healthcare platform connecting patients with doctors for appointments, teleconsultations, prescriptions, and medical record management.",
        "pm":    pms[1],
        "devs":  devs[4:],
        "viewers": viewers[2:],
        "labels": [
            ("Patient Portal",    "#F97316"),
            ("Doctor Portal",     "#3B82F6"),
            ("Appointments",      "#10B981"),
            ("Teleconsultation",  "#EF4444"),
            ("Medical Records",   "#8B5CF6"),
            ("Prescriptions",     "#F59E0B"),
            ("Compliance",        "#06B6D4"),
        ],
        "sprints": [
            {
                "name": "MEDI Sprint 1 — Patient Registration & Profiles",
                "status": "completed",
                "offset": -10, "length": 2,
                "issues": [
                    ("Patient registration with Aadhaar e-KYC", "task", "critical", "done", "Patient Portal"),
                    ("Patient profile — demographics, blood group, allergies", "task", "high", "done", "Patient Portal"),
                    ("Emergency contact management", "task", "high", "done", "Patient Portal"),
                    ("Health ID (ABHA) integration", "task", "critical", "done", "Compliance"),
                    ("Bug: date of birth field allows future dates", "bug", "high", "done", "Patient Portal"),
                    ("Insurance details upload and verification", "task", "high", "done", "Patient Portal"),
                    ("Family member profile management (one account, multiple patients)", "task", "medium", "done", "Patient Portal"),
                    ("Patient consent management (PDPA/DPDP Act)", "task", "critical", "done", "Compliance"),
                    ("Profile completeness indicator", "task", "low", "done", "Patient Portal"),
                    ("Account deactivation and data deletion (DPDP)", "task", "high", "done", "Compliance"),
                    ("SMS/WhatsApp OTP login", "task", "high", "done", "Patient Portal"),
                    ("Bug: OTP expires too quickly on slow network (30s → 120s)", "bug", "medium", "done", "Patient Portal"),
                    ("Profile photo upload", "task", "low", "done", "Patient Portal"),
                    ("Accessibility: screen reader support for registration", "task", "medium", "done", "Patient Portal"),
                    ("Multi-language support: Hindi, Tamil, Bengali", "task", "medium", "done", "Patient Portal"),
                    ("RBAC: patient vs caregiver access levels", "task", "high", "done", "Compliance"),
                    ("Audit log for profile changes", "task", "medium", "done", "Compliance"),
                    ("Duplicate patient detection (same mobile + DOB)", "task", "high", "done", "Patient Portal"),
                    ("Patient onboarding nudge flow (email/SMS)", "task", "low", "done", "Patient Portal"),
                    ("HIPAA-aligned data encryption at rest", "task", "critical", "done", "Compliance"),
                    ("Unit tests for patient registration service", "task", "high", "done", "Patient Portal"),
                ],
            },
            {
                "name": "MEDI Sprint 2 — Doctor Portal & Availability",
                "status": "completed",
                "offset": -8, "length": 2,
                "issues": [
                    ("Doctor registration and MCI verification", "task", "critical", "done", "Doctor Portal"),
                    ("Doctor profile — specialisation, qualifications, fees", "task", "high", "done", "Doctor Portal"),
                    ("Availability schedule management (recurring slots)", "task", "critical", "done", "Appointments"),
                    ("Bug: availability changes not reflected until page refresh", "bug", "high", "done", "Appointments"),
                    ("Leave management for doctors (block dates)", "task", "high", "done", "Appointments"),
                    ("Clinic / hospital location management", "task", "medium", "done", "Doctor Portal"),
                    ("Multiple appointment modes: in-person, video, phone", "task", "high", "done", "Appointments"),
                    ("Appointment slot duration configuration (15/30/45/60 min)", "task", "medium", "done", "Appointments"),
                    ("Doctor search by speciality, location, language", "task", "critical", "done", "Doctor Portal"),
                    ("Doctor profile public page (SEO-friendly)", "task", "medium", "done", "Doctor Portal"),
                    ("Bug: search filter resets on browser back button", "bug", "medium", "done", "Doctor Portal"),
                    ("Doctor verification badge (MCI number validated)", "task", "high", "done", "Compliance"),
                    ("Fee management: consultation, follow-up, emergency", "task", "medium", "done", "Doctor Portal"),
                    ("Doctor availability API for calendar widget", "task", "high", "done", "Appointments"),
                    ("Clinic admin — manage multiple doctors", "task", "medium", "done", "Doctor Portal"),
                    ("Doctor photo and credentials management", "task", "low", "done", "Doctor Portal"),
                    ("Insurance empanelment flag per doctor", "task", "medium", "done", "Doctor Portal"),
                    ("Experience and education CRUD", "task", "low", "done", "Doctor Portal"),
                    ("Performance: availability API < 200ms", "task", "high", "done", "Appointments"),
                    ("Integration test: availability → booking slot lock", "task", "high", "done", "Appointments"),
                    ("Doctor onboarding email sequence", "task", "low", "done", "Doctor Portal"),
                ],
            },
            {
                "name": "MEDI Sprint 3 — Appointment Booking",
                "status": "completed",
                "offset": -6, "length": 2,
                "issues": [
                    ("Appointment booking UI with slot calendar", "task", "critical", "done", "Appointments"),
                    ("Real-time slot locking (2-min hold)", "task", "critical", "done", "Appointments"),
                    ("Appointment confirmation SMS and email", "task", "high", "done", "Appointments"),
                    ("Appointment rescheduling by patient", "task", "high", "done", "Appointments"),
                    ("Appointment cancellation with refund trigger", "task", "high", "done", "Appointments"),
                    ("Bug: double booking when two patients book same slot simultaneously", "bug", "critical", "done", "Appointments"),
                    ("24h and 1h reminder notifications", "task", "high", "done", "Appointments"),
                    ("Doctor no-show reporting by patient", "task", "medium", "done", "Appointments"),
                    ("Appointment receipt PDF download", "task", "medium", "done", "Appointments"),
                    ("Pre-consultation questionnaire per speciality", "task", "medium", "done", "Appointments"),
                    ("Priority booking for follow-up consultations", "task", "medium", "done", "Appointments"),
                    ("Appointment queue management for walk-ins", "task", "medium", "done", "Appointments"),
                    ("Bug: rescheduling doesn't release original slot", "bug", "high", "done", "Appointments"),
                    ("Patient appointment history (past + upcoming)", "task", "medium", "done", "Patient Portal"),
                    ("Doctor appointment schedule daily view", "task", "high", "done", "Doctor Portal"),
                    ("Waiting list for fully-booked slots", "task", "medium", "done", "Appointments"),
                    ("Online payment for appointment booking", "task", "critical", "done", "Appointments"),
                    ("Insurance claim pre-authorisation request", "task", "medium", "done", "Compliance"),
                    ("Appointment analytics: cancellation rate, no-show", "task", "medium", "done", "Appointments"),
                    ("Load test: 200 concurrent bookings", "task", "high", "done", "Appointments"),
                    ("Integration test: slot lock → payment → confirmation", "task", "high", "done", "Appointments"),
                ],
            },
            {
                "name": "MEDI Sprint 4 — Teleconsultation",
                "status": "active",
                "offset": -2, "length": 2,
                "issues": [
                    ("Video consultation via WebRTC", "task", "critical", "in_progress", "Teleconsultation"),
                    ("Patient waiting room UI", "task", "high", "in_progress", "Teleconsultation"),
                    ("Doctor video session dashboard", "task", "high", "in_progress", "Teleconsultation"),
                    ("Bug: video drops to audio-only on 2G network", "bug", "high", "in_progress", "Teleconsultation"),
                    ("Screen sharing for report review", "task", "medium", "todo", "Teleconsultation"),
                    ("In-call text chat", "task", "medium", "in_progress", "Teleconsultation"),
                    ("Session recording with consent (patient + doctor)", "task", "high", "todo", "Teleconsultation"),
                    ("Prescription issue during/after teleconsult", "task", "critical", "in_progress", "Prescriptions"),
                    ("Digital prescription with doctor e-signature", "task", "critical", "in_progress", "Prescriptions"),
                    ("Bug: prescription not linked to appointment on creation", "bug", "critical", "in_progress", "Prescriptions"),
                    ("Telemedicine regulatory compliance check (Telemedicine Practice Guidelines 2020)", "task", "critical", "in_progress", "Compliance"),
                    ("Session timeout and reconnect flow", "task", "high", "todo", "Teleconsultation"),
                    ("Bandwidth adaptive quality switching", "task", "high", "todo", "Teleconsultation"),
                    ("Post-consultation summary auto-generated (AI)", "task", "medium", "todo", "Teleconsultation"),
                    ("Session duration billing (per-minute overflow)", "task", "medium", "todo", "Teleconsultation"),
                    ("Multi-party teleconsult (patient + specialist + GP)", "task", "medium", "todo", "Teleconsultation"),
                    ("Teleconsult for mental health — additional privacy flags", "task", "high", "todo", "Compliance"),
                    ("TURN server setup for NAT traversal", "task", "high", "in_progress", "Teleconsultation"),
                    ("Performance: session start < 5s after both join", "task", "high", "todo", "Teleconsultation"),
                    ("Load test: 100 concurrent video sessions", "task", "high", "todo", "Teleconsultation"),
                    ("End-to-end test: book → wait → consult → prescription", "task", "high", "todo", "Teleconsultation"),
                ],
            },
            {
                "name": "MEDI Sprint 5 — Medical Records & Compliance",
                "status": "planned",
                "offset": 2, "length": 2,
                "issues": [
                    ("Patient medical records repository (PHR)", "task", "critical", "todo", "Medical Records"),
                    ("Lab report upload and categorisation", "task", "high", "todo", "Medical Records"),
                    ("Radiology image viewer (DICOM)", "task", "high", "todo", "Medical Records"),
                    ("Prescription history timeline", "task", "high", "todo", "Medical Records"),
                    ("Bug: uploaded lab report not visible to treating doctor", "bug", "high", "todo", "Medical Records"),
                    ("Share medical records with doctor (access control)", "task", "critical", "todo", "Medical Records"),
                    ("ABDM (Ayushman Bharat Digital Mission) FHIR R4 integration", "task", "critical", "todo", "Compliance"),
                    ("Consent manager for record sharing (ABDM)", "task", "critical", "todo", "Compliance"),
                    ("Diagnosis and ICD-10 code tagging", "task", "high", "todo", "Medical Records"),
                    ("Allergy and chronic condition tracking", "task", "high", "todo", "Medical Records"),
                    ("Immunisation record management", "task", "medium", "todo", "Medical Records"),
                    ("Family health history module", "task", "medium", "todo", "Medical Records"),
                    ("Medical record audit trail (who accessed, when)", "task", "critical", "todo", "Compliance"),
                    ("DPDP-compliant data retention policy enforcement", "task", "critical", "todo", "Compliance"),
                    ("Right to erasure: patient data deletion workflow", "task", "high", "todo", "Compliance"),
                    ("IS/ISO 27001 controls implementation checklist", "task", "high", "todo", "Compliance"),
                    ("Breach notification workflow (72-hour rule)", "task", "critical", "todo", "Compliance"),
                    ("AI: drug interaction checker on prescription", "task", "high", "todo", "Prescriptions"),
                    ("Prescription refill reminder notification", "task", "medium", "todo", "Prescriptions"),
                    ("Health analytics dashboard for patient (vitals trend)", "task", "medium", "todo", "Medical Records"),
                    ("Export complete health record (PDF/FHIR JSON)", "task", "medium", "todo", "Medical Records"),
                ],
            },
        ],
        "backlog": [
            ("AI symptom checker chatbot", "task", "high", "Patient Portal"),
            ("Home sample collection scheduling (lab tests)", "task", "medium", "Appointments"),
            ("Medicine delivery integration (pharmacy API)", "task", "medium", "Prescriptions"),
            ("Wearable device data sync (Apple Health, Google Fit)", "task", "medium", "Medical Records"),
            ("Mental health assessment and therapy booking", "task", "high", "Appointments"),
            ("Hospital bed availability real-time feed", "task", "medium", "Doctor Portal"),
            ("Second opinion request to specialist", "task", "medium", "Appointments"),
            ("Health insurance claim submission workflow", "task", "high", "Compliance"),
            ("Bug: search autocomplete shows inactive doctors", "bug", "medium", "Doctor Portal"),
            ("Paediatric module — growth chart tracking", "task", "medium", "Medical Records"),
        ],
        "wiki_pages": [
            ("MediConnect Platform Overview", "# MediConnect\n\nMediConnect is a digital healthcare platform enabling patients to discover doctors, book appointments (in-person or video), and manage their complete health journey digitally.\n\n## Regulatory Framework\n- Telemedicine Practice Guidelines 2020 (MoHFW)\n- DPDP Act 2023 (data privacy)\n- ABDM (Ayushman Bharat Digital Mission)\n- IS/ISO 27001 information security\n\n## Key Modules\n- Patient & Doctor Portals\n- Appointment Booking Engine\n- Teleconsultation (WebRTC)\n- Prescriptions (digital, e-signed)\n- Medical Records (PHR + FHIR)", None),
            ("Telemedicine Guidelines Compliance", "# Telemedicine Compliance\n\n## MoHFW Telemedicine Practice Guidelines 2020\n\n### Permitted Consultation Types\n| Type    | First Consult | Follow-up |\n|---------|--------------|----------|\n| Video   | Yes          | Yes      |\n| Audio   | Yes          | Yes      |\n| Text    | Limited      | Yes      |\n\n### Prescription Rules\n- Schedule H drugs: video consult mandatory\n- Schedule H1 / X drugs: prohibited via telemedicine\n- OTC drugs: text consult sufficient\n\n### Record Keeping\n- All teleconsultation records must be retained ≥ 7 years\n- Patient consent must be documented before first consultation", None),
            ("Appointment Booking SOP", "# Appointment Booking SOP\n\n## Patient Flow\n1. Search doctor by speciality / location\n2. Select available slot\n3. Fill pre-consultation questionnaire\n4. Pay online (or at clinic)\n5. Receive confirmation SMS + email\n6. Attend appointment\n7. Rate and review doctor\n\n## Slot Locking\nSlots are soft-locked for 2 minutes during checkout. If payment not completed, slot is released automatically.", None),
            ("Data Privacy Policy", "# Data Privacy — DPDP Act 2023\n\n## Patient Rights\n- Right to access their data\n- Right to correct inaccurate data\n- Right to erasure (with exceptions for medical necessity)\n- Right to data portability (FHIR export)\n\n## Consent Requirements\n- Explicit consent for data collection at registration\n- Granular consent for sharing records with doctors\n- Consent for marketing communications (separate, opt-in)\n\n## Retention Schedule\n| Data Type          | Retention  |\n|--------------------|------------|\n| Medical records    | 7 years    |\n| Appointment logs   | 5 years    |\n| Payment records    | 7 years    |\n| Marketing data     | 2 years    |", None),
        ],
    },
]

# ── STEP 3: CREATE PROJECTS, LABELS, MEMBERS, SPRINTS, ISSUES, WIKI ───────────

print("\n[3] Seeding projects …")

for pdef in PROJECTS_DEF:
    print(f"\n  Project: {pdef['name']} ({pdef['key']})")

    # Project
    project = Project.objects.create(
        key=pdef["key"],
        name=pdef["name"],
        description=pdef["desc"],
        owner=pdef["pm"],
    )

    # Members
    members_to_add = [pdef["pm"]] + pdef["devs"] + pdef["viewers"] + [admin]
    for u in members_to_add:
        ProjectMember.objects.get_or_create(project=project, user=u)
    p(f"members: {len(members_to_add)}")

    # Labels
    label_map: dict[str, Label] = {}
    for lname, lcolor in pdef["labels"]:
        lbl = Label.objects.create(name=lname, color=lcolor, project=project)
        label_map[lname] = lbl
    p(f"labels : {len(label_map)}")

    # Sprints + Issues
    total_issues = 0
    assignable = pdef["devs"]

    for sdef in pdef["sprints"]:
        start, end = sprint_window(sdef["offset"], sdef.get("length", 2))
        sprint = Sprint.objects.create(
            project=project,
            name=sdef["name"],
            status=sdef["status"],
            start_date=start,
            end_date=end,
        )
        for (title, itype, prio, status, label_name) in sdef["issues"]:
            lbl = label_map.get(label_name)
            _pts_map = {'critical': [5, 8, 13], 'high': [3, 5, 8], 'medium': [2, 3, 5], 'low': [1, 2, 3]}
            issue = Issue.objects.create(
                project=project,
                sprint=sprint,
                title=title,
                description=f"[{pdef['key']}] {title}. Part of {sdef['name']}.",
                status=status,
                priority=prio,
                issue_type=itype,
                assignee=pick(assignable),
                reporter=pdef["pm"],
                story_points=random.choice(_pts_map.get(prio, [3, 5])),
            )
            if lbl:
                issue.labels.add(lbl)
            total_issues += 1

    # Backlog issues (no sprint)
    for (title, itype, prio, label_name) in pdef["backlog"]:
        lbl = label_map.get(label_name)
        _pts_map = {'critical': [5, 8, 13], 'high': [3, 5, 8], 'medium': [2, 3, 5], 'low': [1, 2, 3]}
        issue = Issue.objects.create(
            project=project,
            sprint=None,
            title=title,
            description=f"[{pdef['key']}] Backlog: {title}.",
            status="todo",
            priority=prio,
            issue_type=itype,
            assignee=pick(assignable),
            reporter=pdef["pm"],
            story_points=random.choice(_pts_map.get(prio, [3, 5])),
        )
        if lbl:
            issue.labels.add(lbl)
        total_issues += 1

    p(f"issues : {total_issues}")

    # Wiki space + pages
    space = WikiSpace.objects.create(project=project, name=f"{pdef['name']} Wiki", created_by=pdef["pm"])
    page_count = 0
    parent_page = None
    for i, (title, content, _parent) in enumerate(pdef["wiki_pages"]):
        wp = WikiPage.objects.create(
            project=project,
            space=space,
            title=title,
            content=content,
            created_by=pdef["pm"],
            updated_by=pdef["pm"],
            parent=parent_page if i > 0 else None,
        )
        if i == 0:
            parent_page = wp
        page_count += 1
    p(f"wiki   : {page_count} pages")

# ── STEP 4: AI SYNC ───────────────────────────────────────────────────────────

if SYNC_TO_CHROMA:
    print("\n[4] Triggering AI sync (ChromaDB population) …")
    try:
        resp = requests.post(f"{AI_BASE_URL}/sync/full", timeout=600)
        if resp.ok:
            data = resp.json()
            p(f"Sync OK — {data}")
        else:
            p(f"Sync returned HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        p(f"Sync failed (AI service may not be running): {e}")
else:
    print("\n[4] ChromaDB sync skipped (SYNC_TO_CHROMA=False).")

# ── DONE ──────────────────────────────────────────────────────────────────────

print("\n✅  Seed complete!\n")
print("  Login credentials (all passwords: Test@123)")
print("  ┌──────────────────┬──────────────┬───────────┐")
print("  │ Username         │ Role         │ Email     │")
print("  ├──────────────────┼──────────────┼───────────┤")
all_creds = [
    ("admin_raj",  "admin",     "admin.raj@brainboard.io"),
    ("pm_priya",   "pm",        "priya.sharma@brainboard.io"),
    ("pm_arjun",   "pm",        "arjun.mehta@brainboard.io"),
    ("pm_sara",    "pm",        "sara.thomas@brainboard.io"),
    ("pm_vikram",  "pm",        "vikram.nair@brainboard.io"),
    ("dev_aisha",  "developer", "aisha.khan@brainboard.io"),
    ("dev_rohan",  "developer", "rohan.gupta@brainboard.io"),
    ("dev_neha",   "developer", "neha.joshi@brainboard.io"),
    ("dev_karan",  "developer", "karan.patel@brainboard.io"),
    ("dev_meera",  "developer", "meera.reddy@brainboard.io"),
    ("dev_saurav", "developer", "saurav.das@brainboard.io"),
    ("dev_tanvi",  "developer", "tanvi.singh@brainboard.io"),
    ("dev_amit",   "developer", "amit.bose@brainboard.io"),
    ("view_pooja", "viewer",    "pooja.iyer@brainboard.io"),
    ("view_ankit", "viewer",    "ankit.verma@brainboard.io"),
    ("view_divya", "viewer",    "divya.menon@brainboard.io"),
    ("view_rahul", "viewer",    "rahul.mishra@brainboard.io"),
    ("view_sneha", "viewer",    "sneha.pillai@brainboard.io"),
]
for uname, role, email in all_creds:
    print(f"  │ {uname:<16} │ {role:<12} │ Test@123  │")
print("  └──────────────────┴──────────────┴───────────┘")
