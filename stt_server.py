#!/usr/bin/env python3
"""
Whisper STT 서버
음성 파일을 받아서 텍스트로 변환
"""

import os
import tempfile
from flask import Flask, request, jsonify
import whisper

app = Flask(__name__)

# Whisper 모델 로드 (base 모델)
print("🔄 Whisper 모델 로드 중... (처음엔 느림)")
model = whisper.load_model("base")
print("✅ Whisper 모델 준비 완료")

@app.route('/health', methods=['GET'])
def health():
    """헬스 체크"""
    return jsonify({"status": "ok", "model": "whisper-base"})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    POST /transcribe
    요청: audio/wav 파일
    응답: JSON {"text": "인식된 텍스트"}
    """
    try:
        # 음성 파일 받기
        if 'audio' not in request.files:
            return jsonify({"error": "audio 파일이 필요합니다"}), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({"error": "파일이 비어있습니다"}), 400
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            # Whisper로 음성 인식
            print(f"🎙️ STT 처리 중... ({audio_file.filename})")
            result = model.transcribe(tmp_path, language="ko")
            text = result["text"].strip()
            
            print(f"✅ 인식 완료: {text}")
            
            return jsonify({
                "ok": True,
                "text": text,
                "language": result.get("language", "ko")
            })
        
        finally:
            # 임시 파일 삭제
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except Exception as e:
        print(f"❌ STT 오류: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    print("\n🚀 STT 서버 시작")
    print("📍 http://localhost:5000")
    print("🔗 엔드포인트: POST /transcribe")
    print()
    app.run(port=5000, debug=False)
