from flask import Flask, render_template, request, jsonify
import requests
import os
import unicodedata
from dotenv import load_dotenv
from services.region import address_to_codes

load_dotenv()
app = Flask(__name__)
app.json.sort_keys = False

PHOTO_BASE = "/static/images"
SCHOOL_PHOTOS = {
    # 학교별 사진 매핑 (몇 개만)
}
DISABILITY_RATE_FIELDS = [
    ("시각장애",      "VISUALLY_RATE"),
    ("청각장애",      "HEARING_RATE"),
    ("정신지체",      "PSYCHO_RATE"),
    ("지체장애",      "INVALID1_RATE"),
    ("정서·행동장애", "DISTURBED_RATE"),
    ("자폐성장애",    "AUTIS_RATE"),
    ("의사소통장애",  "IMPEDIMENT_RATE"),
    ("학습장애",      "HDST_RATE"),
    ("건강장애",      "HLTH_RATE"),
    ("발달지체",      "DEV_RATE"),
    ("기타",          "ETC_STD_RATE"),
]

AFTERSCHOOL_FIELDS = {
    "curriculum_pgm":     "ASL_CURR_PGM_FGR",          
    "curriculum_student": "ASL_CURR_REG_STDNT_FGR",    
    "aptitude_pgm":       "ASL_SPABL_APTD_PGM_FGR",    
    "aptitude_student":   "ASL_SPABL_APTD_REG_STDNT_FGR",
    "total_participants": "ASL_PTPT_STDNT_FGR",        
    "special_classes":    "SPCLY_ADY_CCCCL_FGR",      
    "special_students":   "SPCLY_ADY_PTPT_STDNT_FGR",  
}

def normalize(s: str) -> str:
    return unicodedata.normalize("NFC", (s or "").replace(" ", "").strip())

def call_schoolinfo(api_key, sido_code, sgg_code=None, year="2024", api_type="09"):
    url = "https://www.schoolinfo.go.kr/openApi.do"
    params = {
        "apiKey":       api_key,
        "apiType":      api_type,        # ← 일반화
        "pbanYr":       year,
        "schulKndCode": "05",
        "sidoCode":     sido_code,
    }
    if sgg_code:
        params["sggCode"] = sgg_code
    res  = requests.get(url, params=params, timeout=10)
    return res.json().get("list", [])

def parse_disability_rates(row):
    """0이 아닌 비율만 추출"""
    out = {}
    for label, field in DISABILITY_RATE_FIELDS:
        try:
            v = float(row.get(field) or 0)
            if v > 0:
                out[label] = v
        except (ValueError, TypeError):
            pass
    return out

def parse_afterschool(row):
    out = {}
    for key, field in AFTERSCHOOL_FIELDS.items():
        try:
            out[key] = int(float(row.get(field) or 0))
        except (ValueError, TypeError):
            out[key] = 0
    return out

def match_school(rows, name):
    def norm(s):
        s = unicodedata.normalize("NFC", (s or "").replace(" ", "").strip())
        # "특수수도사랑의학교" → "수도사랑의학교"
        if s.startswith("특수"):
            s = s[2:]
        return s

    target = norm(name)
    if not target:
        return None
    for r in rows:
        if norm(r.get("SCHUL_NM")) == target:
            return r
    for r in rows:
        if target in norm(r.get("SCHUL_NM")):
            return r
    return None

def parse_special_school(row):
    """특수학교(특) 한 행을 카드/차트용 형태로 변환"""
    def i(f):
        val = row.get(f, 0)
        try:
            return int(float(val if val else 0))
        except (ValueError, TypeError):
            return 0

    유        = i("COL_S1")        # 유치부
    유순회    = i("COL_S15")       # 유치부-순회
    유초등_계 = i("COL_SUM_S1")    # 유초등부 합계
    초등      = max(유초등_계 - 유 - 유순회, 0)  # 1~6학년 + 초순회
    중등      = i("COL_SUM_S2")
    고등      = i("COL_SUM_S3")
    전공과    = i("COL_S14")

    levels = {}
    if 유 > 0:     levels["유치부"] = 유
    if 초등 > 0:   levels["초등부"] = 초등
    if 중등 > 0:   levels["중등부"] = 중등
    if 고등 > 0:   levels["고등부"] = 고등
    if 전공과 > 0: levels["전공과"] = 전공과

    total_students = i("COL_S_SUM")
    teachers       = i("TEACH_CNT")

    # TEACH_CAL이 비어있거나 0인 학교는 직접 계산
    teach_cal_raw = float(row.get("TEACH_CAL", 0) or 0)
    if teach_cal_raw > 0:
        students_per_teacher = teach_cal_raw
    elif teachers > 0:
        students_per_teacher = round(total_students / teachers, 1)
    else:
        students_per_teacher = None

    return {
        "levels":              levels,
        "has_kindergarten":    유 > 0,
        "has_elementary":      초등 > 0,
        "has_middle":          중등 > 0,
        "has_high":            고등 > 0,
        "has_vocational":      전공과 > 0,
        "total_students":      total_students,
        "teachers":            teachers,
        "students_per_teacher": students_per_teacher,
    }


@app.route('/')
def root():
    return render_template("index.html", KAKAO_MAP_KEY=os.getenv("KAKAO_MAP_KEY"))


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
        "returnType": "JSON",
    }
    res = requests.get(url, params=params)
    rows = res.json().get("data", [])

    if region:
        rows = [r for r in rows if r.get("시도") == region]

    schools = []
    for r in rows:
        address = r.get("주소")
        sido_code, sgg_code = address_to_codes(address)
        schools.append({
            "name":         r.get("기관명"),
            "address":      address,
            "tel":          r.get("행정실") or r.get("교무실") or r.get("교장실"),
            "homepage":     r.get("홈페이지"),
            "founder":      r.get("설립별"),
            "disable_type": r.get("장애영역"),
            "photo":        SCHOOL_PHOTOS.get(r.get("기관명"), f"{PHOTO_BASE}/default.jpg"),
            "sido_code":    sido_code,
            "sgg_code":     sgg_code,
        })
    return jsonify(schools)


@app.route('/api/school_detail')
def school_detail():
    school_name = request.args.get('school_name')
    sido_code   = request.args.get('sido_code')
    sgg_code    = request.args.get('sgg_code')

    if not (sido_code and sgg_code and school_name):
        return jsonify({"error": "코드 누락"}), 400

    api_key = os.getenv("SCHOOLINFO_KEY")
    result = {}

    try:
        # 1) 학년별 학생수 (apiType=09)
        rows_09 = call_schoolinfo(api_key, sido_code, sgg_code, api_type="09")
        if not rows_09:
            rows_09 = call_schoolinfo(api_key, sido_code, sgg_code=None, api_type="09")
        target_09 = match_school(rows_09, school_name) if rows_09 else None
        if target_09:
            result.update(parse_special_school(target_09))

        # 2) 입학생 장애유형별 비율 (apiType=51)
        rows_51 = call_schoolinfo(api_key, sido_code, sgg_code, api_type="51")
        if not rows_51:
            rows_51 = call_schoolinfo(api_key, sido_code, sgg_code=None, api_type="51")
        target_51 = match_school(rows_51, school_name) if rows_51 else None
        if target_51:
            result["disability_rates"] = parse_disability_rates(target_51)

        # 3) 방과후학교 (apiType=59)
        rows_59 = call_schoolinfo(api_key, sido_code, sgg_code, api_type="59")
        if not rows_59:
            rows_59 = call_schoolinfo(api_key, sido_code, sgg_code=None, api_type="59")
        target_59 = match_school(rows_59, school_name) if rows_59 else None
        if target_59:
            result["afterschool"] = parse_afterschool(target_59)

        if not result:
            return jsonify({"error": "데이터 없음"}), 404
        return jsonify(result)

    except ValueError as e:
        return jsonify({"error": "응답 파싱 실패", "detail": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)