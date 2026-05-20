from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.json.sort_keys = False

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'special_schools.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# -------------------------------------------------------------------------
# MySQL 테이블 모델 정의
# -------------------------------------------------------------------------
class School(db.Model):
    __tablename__ = 'schools'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    address = db.Column(db.String(512))
    lat = db.Column(db.Double)  # 위도 (DB에서 직접 관리)
    lng = db.Column(db.Double)  # 경도 (DB에서 직접 관리)
    tel = db.Column(db.String(50))
    homepage = db.Column(db.String(255))
    founder = db.Column(db.String(50), index=True)      # 국립/공립/사립
    disable_type = db.Column(db.String(255), index=True) # 장애 영역 종류 문자열
    
    # 학년(과정) 포함 여부를 Boolean 플래그로 저장 (필터 속도 최적화)
    has_kindergarten = db.Column(db.Boolean, default=False)
    has_elementary = db.Column(db.Boolean, default=False)
    has_middle = db.Column(db.Boolean, default=False)
    has_high = db.Column(db.Boolean, default=False)
    has_vocational = db.Column(db.Boolean, default=False)

    # 도시(시/도)명 및 방과후학교 상세 필터 플래그
    sido = db.Column(db.String(50), index=True)
    has_after_curr = db.Column(db.Boolean, default=False)    # 교과 프로그램 운영 여부
    has_after_apt = db.Column(db.Boolean, default=False)     # 특기적성 운영 여부
    has_after_allday = db.Column(db.Boolean, default=False)
    
    # 상세 차트용 정보 데이터 일체를 JSON 텍스트 형태로 통째로 보관
    details_json = db.Column(db.Text)


@app.route('/')
def root():
    return render_template("index.html", KAKAO_MAP_KEY=os.getenv("KAKAO_MAP_KEY"))

# app.py 의 get_schools() 함수 부분을 아래와 같이 수정하세요.

@app.route('/api/schools')
def get_schools():
    what_school = request.args.get('what_school', 'all')
    disability_type = request.args.get('disability_type', 'all')
    grades_raw = request.args.get('grades', '')
    grades = grades_raw.split(',') if grades_raw else []

    # 🌟 새로 추가: 시도 필터 및 방과후 필터 파라미터 받기
    sido = request.args.get('sido', 'all')
    after_raw = request.args.get('afterschools', '')
    afterschools = after_raw.split(',') if after_raw else []

    query = School.query

    # 기존 일반 필터들
    if what_school != 'all':
        query = query.filter(School.founder == what_school)
    if disability_type != 'all':
        query = query.filter(School.disable_type.like(f"%{disability_type}%"))
    if grades:
        grade_conditions = []
        if "유치부" in grades: grade_conditions.append(School.has_kindergarten == True)
        if "초등부" in grades: grade_conditions.append(School.has_elementary == True)
        if "중등부" in grades: grade_conditions.append(School.has_middle == True)
        if "고등부" in grades: grade_conditions.append(School.has_high == True)
        if "전공과" in grades: grade_conditions.append(School.has_vocational == True)
        if grade_conditions:
            query = query.filter(or_(*grade_conditions))

    # 🌟 새로 추가 1: 큰 도시별(시/도) 필터 적용
    if sido != 'all':
        query = query.filter(School.sido == sido)

    # 🌟 새로 추가 2: 방과후 프로그램 조건 필터 적용 (AND 연산)
    if "curr" in afterschools:
        query = query.filter(School.has_after_curr == True)
    if "apt" in afterschools:
        query = query.filter(School.has_after_apt == True)
    if "allday" in afterschools:
        query = query.filter(School.has_after_allday == True)

    rows = query.all()
    
    schools = []
    for s in rows:
        photo_filename = f"{s.name}.jpg"
        photo_path = os.path.join(app.static_folder, "images", photo_filename)
        photo_url = (
            f"/static/images/{photo_filename}"
            if os.path.exists(photo_path)
            else "/static/images/default.jpg"
        )

        schools.append({
            "name": s.name,
            "address": s.address,
            "tel": s.tel,
            "homepage": s.homepage,
            "founder": s.founder,
            "disable_type": s.disable_type,
            "photo": photo_url
        })
    return jsonify(schools)
# -------------------------------------------------------------------------
# 🌟 카드 전용 상세 데이터 조회 API (DB에서 즉시 꺼내옴)
# -------------------------------------------------------------------------
@app.route('/api/school_detail')
def school_detail():
    school_name = request.args.get('school_name')
    if not school_name:
        return jsonify({"error": "학교 이름 누락"}), 400

    school = School.query.filter(School.name == school_name).first()

    if not school or not school.details_json:
        return jsonify({"error": "데이터 없음"}), 404

    # 저장해둔 상세 정보 JSON 문자열을 파싱해서 그대로 반환
    return jsonify(json.loads(school.details_json))

if __name__ == "__main__":
    with app.app_context():
        db.create_all() # 데이터베이스 테이블이 없다면 자동 생성
    app.run(debug=True)
