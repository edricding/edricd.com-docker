from fastapi import FastAPI

app = FastAPI(title="edricd.com API")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/v1/hello")
def hello(name: str = "world"):
    return {"message": f"hello, {name}"}
