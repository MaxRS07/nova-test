from typing import TypedDict

class Agent(TypedDict):
    id: str
    name: str
    actions: list[str]
    context: str
    url: str
    fileNames: list[str]
    config: dict[str, float | int]
    selectedTools: list[str]
    created: str
