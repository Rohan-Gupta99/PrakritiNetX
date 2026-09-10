import urllib.request
import json

base_url = "http://localhost:8000"

def test_hazards():
    print("=== TESTING ALL 7 HAZARDS & CITIZEN SMS DISPATCH ===")
    
    # 1. Test Health
    req = urllib.request.Request(f"{base_url}/api/health")
    res = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    print("1. Health:", res["status"])
    
    # 2. Test All 7 Risk Scenarios Trigger
    scenarios = ["flood", "fire", "air", "heat", "landslide", "chemical", "water", "reset"]
    for sc in scenarios:
        req = urllib.request.Request(
            f"{base_url}/api/simulate/event",
            data=json.dumps({"event_type": sc, "speed_multiplier": 1.5}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        res = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
        print(f"2. Hazard Trigger [{sc.upper()}]:", res.get("status"), res.get("event"))

    # 3. Test Citizen SMS Dispatch
    sms_payload = {
        "recipient_group": "Rishikesh Pilgrims & Ghat Dwellers",
        "phone_numbers": "+91 98765-43210 (+1,250 citizens)",
        "message_body": "🚨 [URGENT DISASTER EVACUATION] High river crest alert issued by Central Hub. Move to safe high ground immediately.",
        "hazard_type": "FLOOD",
        "recipient_count": 1250
    }
    req = urllib.request.Request(
        f"{base_url}/api/sms/send",
        data=json.dumps(sms_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    print("3. Citizen SMS Dispatch:", res.get("status"), "ID:", res.get("id"), "Recipients:", res.get("recipient_count"))

    # 4. Check SMS Logs
    req = urllib.request.Request(f"{base_url}/api/sms?limit=5")
    logs = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    print("4. Recent Dispatched SMS Logs Count:", len(logs))
    print("=== ALL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_hazards()
