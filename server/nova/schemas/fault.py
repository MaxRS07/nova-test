from pydantic import BaseModel

class Fault(BaseModel):
    message: str
    type: str
    traceback: str
    
class Faults(BaseModel):
    faults: list[Fault]
