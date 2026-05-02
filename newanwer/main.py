"""Entry point - runs the Abu_Malk-Services app."""
from app import app, socketio
import os
import logging

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    print(f"🌐 تشغيل Abu_Malk-Services على المنفذ {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
