from flask import Flask, render_template, request, jsonify
import requests
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

PHOTO_BASE = "/static/images"

SCHOOL_PHOTOS = {
    # 한 사진 5개만 
}

@app.route('/')
def root():
    KAKAO_MAP_KEY = os.getenv("KAKAO_MAP_KEY")
    return render_template("index.html", KAKAO_MAP_KEY=KAKAO_MAP_KEY)

@app.route('/api/schools')
def get_schools():
    region = request.args.get('region')
    key  = os.getenv("DATA_GO_KR_KEY")
    uddi = os.getenv("SPECIAL_SCHOOL_UDDI")

    url = f"https://api.odcloud.kr/api/15052682/v1/{uddi}"
    params = {
        "serviceKey": key,
        "page": 1,
        "perPage": 500,      
        "returnType": "JSON"
    }
    res = requests.get(url, params=params)
    data = res.json()

    rows = data.get("data", [])

    if region:
        rows = [r for r in rows if r.get("시도") == region]

    schools = [
        {
            "name":         r.get("기관명"),
            "address":      r.get("주소"),
            "tel":          r.get("행정실") or r.get("교무실") or r.get("교장실"),
            "homepage":     r.get("홈페이지"),
            "founder":      r.get("설립별"),       
            "disable_type": r.get("장애영역"),  
            "photo":        SCHOOL_PHOTOS.get(r.get("기관명"), f"{PHOTO_BASE}/default.jpg")
        }
        for r in rows
    ]
    return jsonify(schools)

if __name__ == "__main__":
    app.run()