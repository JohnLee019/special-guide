from flask import Flask, render_template
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/')
def root():
    KAKAO_MAP_KEY = os.getenv("KAKAO_MAP_KEY")
    return render_template("index.html", KAKAO_MAP_KEY=KAKAO_MAP_KEY)

if __name__ == "__main__":
    app.run()