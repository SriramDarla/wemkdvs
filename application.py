"""
AWS Elastic Beanstalk entrypoint wrapper.
Exposes 'application' and 'app' referencing the FastAPI instance in app.py.
"""
from app import app as application

app = application

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
