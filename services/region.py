import json

with open("data/region_codes.json", encoding="utf-8") as f:
    REGION = json.load(f)

SIDO_ALIASES = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
    "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
    "울산": "울산광역시", "세종": "세종특별자치시",
    "경기": "경기도", "강원": "강원특별자치도",
    "충북": "충청북도", "충남": "충청남도",
    "전북": "전북특별자치도", "전라북도": "전북특별자치도",  # 옛 명칭도 매핑
    "전남": "전라남도", "경북": "경상북도", "경남": "경상남도",
    "제주": "제주특별자치도", "강원도": "강원특별자치도",  # 옛 명칭
}

def address_to_codes(address: str):
    if not address:
        return None, None
    parts = address.strip().split()
    if len(parts) < 2:
        return None, None

    sido = SIDO_ALIASES.get(parts[0], parts[0])
    if sido not in REGION:
        return None, None
    sido_code = REGION[sido]["code"]
    sgg_table = REGION[sido]["sgg"]

    # 세종 특수 케이스: "세종특별자치시 ○○동" → 시군구도 "세종특별자치시"
    if sido == "세종특별자치시":
        return sido_code, sgg_table.get("세종특별자치시")

    # 자치구 있는 시 우선 매칭: "수원시 영통구" (3토큰 형태)
    if len(parts) >= 3:
        two_token = f"{parts[1]} {parts[2]}"
        if two_token in sgg_table:
            return sido_code, sgg_table[two_token]
    
    # 일반 매칭: "강남구", "춘천시"
    if parts[1] in sgg_table:
        return sido_code, sgg_table[parts[1]]
    
    return sido_code, None