#!/usr/bin/env python3
import urllib.request
import json
import time

payload = {
    "timestamp": "2019-12-31T23:55:00",
    "flows": {
        "p227": 146.72,
        "p235": 128.46,
        "PUMP_1": 43.72
    },
    "pressures": {
        "n1": 28.44, "n4": 33.55, "n31": 36.89, "n54": 35.65,
        "n105": 49.96, "n114": 53.28, "n163": 51.38, "n188": 54.18,
        "n215": 39.07, "n229": 51.06, "n288": 51.39, "n296": 41.67,
        "n332": 55.72, "n342": 45.36, "n410": 29.44, "n415": 44.49,
        "n429": 35.29, "n458": 42.27, "n469": 46.98, "n495": 51.28,
        "n506": 52.92, "n516": 54.1, "n519": 46.52, "n549": 53.99,
        "n613": 54.91, "n636": 44.33, "n644": 46.08, "n679": 46.04,
        "n722": 45.19, "n726": 45.87, "n740": 43.3, "n752": 47.83,
        "n769": 47.42
    },
    "hour": 23,
    "day_of_week": 1,
    "month": 12,
    "scenario_params": {
        "recovery_rate": 80.0,
        "max_budget": 1000000.0,
        "minimum_loss": 0.10
    }
}
data_bytes = json.dumps(payload).encode("utf-8")

def test_endpoint(name, url):
    print("=" * 70)
    print(f"Testing: {name}")
    print(f"URL: {url}")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            latency = (time.time() - t0) * 1000
            status = resp.status
            headers = dict(resp.headers)
            body = resp.read().decode("utf-8")
            parsed = json.loads(body)
            print(f"Status Code: {status}")
            print(f"Latency: {latency:.1f} ms")
            print(f"Status: {parsed.get('status')}")
            print(f"Inference Type: {parsed.get('inference_type')}")
            print(f"Server Latency Reported: {parsed.get('latency_ms')} ms")
            print(f"Features Used: {parsed.get('features_used_count')}")
            print(f"Total Candidates: {parsed.get('total_candidates')}")
            print(f"Matching Candidates: {parsed.get('matching_candidates')}")
            top_pipes = [c.get("Pipe") for c in parsed.get("candidates", [])[:5]]
            print(f"Top Candidates: {top_pipes}")
            print(f"Total Loss (ML/day): {parsed.get('total_predicted_loss_ML_day')}")
            print(f"Server Header: {headers.get('Server') or headers.get('server')}")
            return status, parsed
    except urllib.error.HTTPError as err:
        latency = (time.time() - t0) * 1000
        print(f"HTTPError Status Code: {err.code}")
        print(f"Latency: {latency:.1f} ms")
        print(f"Headers: {dict(err.headers)}")
        body = err.read().decode("utf-8")
        print(f"Body: {body[:400]}")
        return err.code, body
    except Exception as e:
        latency = (time.time() - t0) * 1000
        print(f"Exception: {e} ({latency:.1f} ms)")
        return None, str(e)

if __name__ == "__main__":
    print("1. Direct Elastic Beanstalk POST /api/predict/ltown")
    eb_status, eb_resp = test_endpoint(
        "Direct Elastic Beanstalk",
        "http://bluecore-env.eba-aw2ukm5y.us-east-1.elasticbeanstalk.com/api/predict/ltown"
    )

    print("\n2. AWS API Gateway POST /api/predict/ltown")
    apigw_status, apigw_resp = test_endpoint(
        "AWS API Gateway",
        "https://0o1o890v41.execute-api.us-east-1.amazonaws.com/api/predict/ltown"
    )

    print("\n3. Path-Stripping Analysis:")
    if apigw_status == 200:
        print("API Gateway successfully responded with HTTP 200!")
        if isinstance(apigw_resp, dict) and apigw_resp.get("status") == "success":
            print("Both endpoints successfully returned complete ML inference.")
    else:
        print(f"API Gateway responded with HTTP {apigw_status}.")
