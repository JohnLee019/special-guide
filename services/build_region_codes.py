import pandas as pd, json

df = pd.read_excel("data/sido_sggCode.xlsx", header=2)  

region = {}
for _, r in df.iterrows():
    sido = str(r["시도명"]).strip()
    region.setdefault(sido, {"code": str(r["시도코드"]), "sgg": {}})
    region[sido]["sgg"][str(r["시군구명"]).strip()] = str(r["시군구코드"])

with open("region_codes.json", "w", encoding="utf-8") as f:
    json.dump(region, f, ensure_ascii=False, indent=2)
