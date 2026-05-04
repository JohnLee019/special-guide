from flask import Flask, render_template, request, jsonify
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/')
def root():
    KAKAO_MAP_KEY = os.getenv("KAKAO_MAP_KEY")
    return render_template("index.html", KAKAO_MAP_KEY=KAKAO_MAP_KEY)

@app.route('/api/schools')
def get_schools():
    region = request.args.get('region')
    NEIS_API_KEY = os.getenv("NEIS_API_KEY")

    params = {
        "KEY": NEIS_API_KEY,
        "Type": "json",
        "pSize": 1000,
        "SCHUL_KND_SC_NM": "특수학교",
        "LCTN_SC_NM": region,
    }
    res = requests.get("https://open.neis.go.kr/hub/schoolInfo", params=params)
    data = res.json()

    if "schoolInfo" not in data:
        return jsonify([])
    
    rows = data["schoolInfo"][1]["row"]
    schools = [
        {
            "name": row.get("SCHUL_NM"),
            "address": row.get("ORG_RDNMA"),
            "tel": row.get("ORG_TELNO"),
            "homepage": row.get("HMPG_ADRES"),
            "founder": row.get("FOND_SC_NM"),       
            "school_code": row.get("SD_SCHUL_CODE"),
        }
        for row in rows
    ]

    return jsonify(schools)



if __name__ == "__main__":
    app.run()