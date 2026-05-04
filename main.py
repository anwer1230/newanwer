"""Entry point - runs the Abu_Malk-Services app."""
from app import app, socketio
import os
import signal
import logging

def free_port(port):
    """تحرير المنفذ إذا كان مشغولاً (للبيئات المحلية فقط)"""
    try:
        if os.environ.get('RENDER'):
            return
            
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        result = s.connect_ex(('127.0.0.1', port))
        s.close()
        if result == 0:
            import subprocess
            subprocess.run(['fuser', '-k', f'{port}/tcp'], capture_output=True)
            import time
            time.sleep(1)
    except Exception:
        pass

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    if os.environ.get('RENDER'):
        print(f"🌐 تشغيل Abu_Malk-Services على المنفذ {port} في بيئة Render")
        socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
    else:
        free_port(port)
        print(f"🌐 تشغيل Abu_Malk-Services على المنفذ {port}")
        socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
