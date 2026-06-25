from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from controllers.auth_controller import router as auth_router
from controllers.admin_controller import router as admin_router

app = FastAPI(title="Multitenant App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {"status": "ok"}
