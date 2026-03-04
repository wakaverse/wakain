"""Backfill temporal_json for existing results that have temporal.json files."""
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
output_dir = Path(__file__).parent / "output"

# Get all results without temporal_json
results = supabase.table("results").select("id, job_id").execute()

updated = 0
for row in results.data:
    job_id = row["job_id"]
    temporal_path = output_dir / job_id / f"{job_id}_temporal.json"
    if temporal_path.exists():
        temporal_data = json.loads(temporal_path.read_text(encoding="utf-8"))
        supabase.table("results").update({"temporal_json": temporal_data}).eq("id", row["id"]).execute()
        print(f"✅ {job_id[:8]} — temporal backfilled")
        updated += 1
    else:
        print(f"⏭ {job_id[:8]} — no temporal file")

print(f"\nDone: {updated} results updated")
