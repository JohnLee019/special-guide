import os
import requests
import json
import unicodedata
from dotenv import load_dotenv

# 루트 폴더에 있는 app.py에서 db 설정과 School 모델을 가져옵니다.
from app import db, School, app
# services/region.py에서 주소 파싱 함수와 도시명 딕셔너리를 가져옵니다.
from services.region import address_to_codes, SIDO_ALIASES

load_dotenv()

# 학교알리미(apiType 51) 장애유형별 학생수 파싱 매핑
DISABILITY_RATE_FIELDS = [
    ("시각장애", "VISUALLY_RATE"), ("청각장애", "HEARING_RATE"), ("정신지체", "PSYCHO_RATE"),
    ("지체장애", "INVALID1_RATE"), ("정서·행동장애", "DISTURBED_RATE"), ("자폐성장애", "AUTIS_RATE"),
    ("의사소통장애", "IMPEDIMENT_RATE"), ("학습장애", "HDST_RATE"), ("건강장애", "HLTH_RATE"),
    ("발달지체", "DEV_RATE"), ("기타", "ETC_STD_RATE")
]

# 학교알리미(apiType 59) 방과후학교 파싱 매핑
AFTERSCHOOL_FIELDS = {
    "curriculum_pgm": "ASL_CURR_PGM_FGR", 
    "curriculum_student": "ASL_CURR_REG_STDNT_FGR",    
    "aptitude_pgm": "ASL_SPABL_APTD_PGM_FGR", 
    "aptitude_student": "ASL_SPABL_APTD_REG_STDNT_FGR",
    "total_participants": "ASL_PTPT_STDNT_FGR", 
    "special_classes": "SPCLY_ADY_CCCCL_FGR",      
    "special_students": "SPCLY_ADY_PTPT_STDNT_FGR"
}

def call_schoolinfo(api_key, sido_code, sgg_code=None, api_type="09"):
    url = "https://www.schoolinfo.go.kr/openApi.do"
    params = {
        "apiKey": api_key, 
        "apiType": api_type, 
        "pbanYr": "2024", 
        "schulKndCode": "05", 
        "sidoCode": sido_code
    }
    if sgg_code: 
        params["sggCode"] = sgg_code
    return requests.get(url, params=params, timeout=10).json().get("list", [])

def match_school(rows, name):
    def norm(s): return unicodedata.normalize("NFC", (s or "").replace(" ", "").strip())
    # "특수" 글자가 앞에 붙어있으면 제거하고 매칭 (예: 특수수도사랑의학교 -> 수도사랑의학교)
    target = norm(name)[2:] if norm(name).startswith("특수") else norm(name)
    if not target: return None
    for r in rows:
        if norm(r.get("SCHUL_NM")) == target or target in norm(r.get("SCHUL_NM")): 
            return r
    return None

def parse_special_school(row):
    def i(f):
        try: return int(float(row.get(f, 0) or 0))
        except: return 0
        
    유, 유순회, 유초등_계 = i("COL_S1"), i("COL_S15"), i("COL_SUM_S1")
    초등 = max(유초등_계 - 유 - 유순회, 0)
    중등, 고등, 전공과 = i("COL_SUM_S2"), i("COL_SUM_S3"), i("COL_S14")
    
    levels = {}
    if 유 > 0: levels["유치부"] = 유
    if 초등 > 0: levels["초등부"] = 초등
    if 중등 > 0: levels["중등부"] = 중등
    if 고등 > 0: levels["고등부"] = 고등
    if 전공과 > 0: levels["전공과"] = 전공과
    
    total = i("COL_S_SUM")
    teachers = i("TEACH_CNT")
    spt = float(row.get("TEACH_CAL", 0) or 0)
    if spt <= 0 and teachers > 0: 
        spt = round(total / teachers, 1)
    
    return {"levels": levels, "total_students": total, "teachers": teachers, "students_per_teacher": spt}


def sync_data():
    print("🔄 마이그레이션 및 데이터 수집 시작 (SQLite)...")
    
    # 공공데이터 API 키 가져오기
    odcloud_key = os.getenv("DATA_GO_KR_KEY")
    uddi = os.getenv("SPECIAL_SCHOOL_UDDI")
    schoolinfo_key = os.getenv("SCHOOLINFO_KEY")
    
    master_url = f"https://api.odcloud.kr/api/15052682/v1/{uddi}?serviceKey={odcloud_key}&page=1&perPage=500&returnType=JSON"
    rows = requests.get(master_url).json().get("data", [])
    
    print(f"발견된 학교 수: {len(rows)}개. 이제 상세 정보를 수집합니다.")
    
    # Flask 앱 컨텍스트 안에서 DB 작업 수행
    with app.app_context():
        # 데이터 꼬임 방지를 위해 기존 테이블을 삭제하고 깨끗하게 다시 생성합니다.
        db.drop_all()
        db.create_all()
        
        for idx, r in enumerate(rows):
            name = r.get("기관명")
            address = r.get("주소")
            print(f"[{idx+1}/{len(rows)}] {name} 처리 중...")
            
            # 주소를 분석하여 지역 코드 가져오기
            sido_code, sgg_code = address_to_codes(address)

            # 🌟 [필터 추가] 지역명(시/도) 정규화
            # 주소의 첫 단어(예: 서울, 경기)를 가져와서 정규화 명칭(서울특별시, 경기도)으로 변환
            addr_parts = address.split() if address else []
            raw_sido = addr_parts[0] if addr_parts else ""
            sido_name = SIDO_ALIASES.get(raw_sido, raw_sido)
            
            # 학교알리미 상세 정보 수집 로직 수행
            detail_res = {}
            if sido_code:
                try:
                    # 1. 학년별 정보 (09)
                    r_09 = call_schoolinfo(schoolinfo_key, sido_code, sgg_code, "09") or call_schoolinfo(schoolinfo_key, sido_code, None, "09")
                    t_09 = match_school(r_09, name)
                    if t_09: detail_res.update(parse_special_school(t_09))
                    
                    # 2. 장애비율 정보 (51)
                    r_51 = call_schoolinfo(schoolinfo_key, sido_code, sgg_code, "51") or call_schoolinfo(schoolinfo_key, sido_code, None, "51")
                    t_51 = match_school(r_51, name)
                    if t_51:
                        rates = {}
                        for label, field in DISABILITY_RATE_FIELDS:
                            try:
                                v = float(t_51.get(field) or 0)
                                if v > 0: rates[label] = v
                            except: pass
                        detail_res["disability_rates"] = rates
                        
                    # 3. 방과후학교 정보 (59)
                    r_59 = call_schoolinfo(schoolinfo_key, sido_code, sgg_code, "59") or call_schoolinfo(schoolinfo_key, sido_code, None, "59")
                    t_59 = match_school(r_59, name)
                    if t_59:
                        aft = {}
                        for k, f in AFTERSCHOOL_FIELDS.items():
                            try: aft[k] = int(float(t_59.get(f) or 0))
                            except: aft[k] = 0
                        detail_res["afterschool"] = aft
                except Exception as e:
                    print(f"⚠️ 상세 정보 수집 실패 ({name}): {e}")

            # 학년(과정) 포함 플래그 계산
            lv = detail_res.get("levels", {})
            
            # 🌟 [필터 추가] 방과후학교 프로그램 개수를 확인하여 플래그 생성
            aft_data = detail_res.get("afterschool", {})
            curr_pgm = aft_data.get("curriculum_pgm", 0)  # 교과 프로그램
            apt_pgm = aft_data.get("aptitude_pgm", 0)     # 특기적성
            special_cls = aft_data.get("special_classes", 0) # 종일반 학급

            # 데이터베이스에 School 인스턴스 생성 및 추가
            school_obj = School(
                name=name,
                address=address,
                lat=None, # 프론트엔드(자바스크립트) 카카오맵 API에서 직접 변환하므로 DB엔 저장 안 함
                lng=None,
                tel=r.get("행정실") or r.get("교무실"),
                homepage=r.get("홈페이지"),
                founder=r.get("설립별"),
                disable_type=r.get("장애영역"),
                
                # 과정 운영 여부 필터 정보
                has_kindergarten="유치부" in lv,
                has_elementary="초등부" in lv,
                has_middle="중등부" in lv,
                has_high="고등부" in lv,
                has_vocational="전공과" in lv,
                
                # 🌟 [필터 추가] 방과후 프로그램 및 도시 정보
                sido=sido_name,
                has_after_curr=(curr_pgm > 0),
                has_after_apt=(apt_pgm > 0),
                has_after_allday=(special_cls > 0),
                
                # 프론트 카드가 띄워줄 전체 통계 JSON 텍스트 원본
                details_json=json.dumps(detail_res, ensure_ascii=False)
            )
            db.session.add(school_obj)
        
        # 반복문이 끝나면 한번에 DB에 커밋(저장)
        db.session.commit()
    print("✅ 모든 데이터가 성공적으로 SQLite에 보관되었습니다!")


if __name__ == "__main__":
    sync_data()