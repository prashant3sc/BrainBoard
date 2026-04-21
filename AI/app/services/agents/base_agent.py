from abc import ABC, abstractmethod
from typing import Any
from app.core.logging import get_logger


class BaseAgent(ABC):
    """
    Abstract base class for all JiraGenie AI agents.

    Every agent must:
    1. Have a descriptive `name` and `description` class attribute.
    2. Implement the `run()` method that executes the agent's primary logic.

    Example of a future agent:
    ---
    class SprintPlanningAgent(BaseAgent):
        name = "Sprint Planning Agent"
        description = "Auto-generates sprint plans from a backlog."

        async def run(self, backlog: list) -> dict:
            # ...your agent logic here...
            return {"sprint_plan": [...]}
    """

    name: str = "BaseAgent"
    description: str = "An abstract AI agent."

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)
        self.logger.info(f"Agent initialized: {self.name}")

    @abstractmethod
    async def run(self, *args: Any, **kwargs: Any) -> Any:
        """
        Execute the agent's primary logic.
        Must be implemented by every subclass.
        """
        raise NotImplementedError(
            f"Agent '{self.name}' must implement the `run()` method."
        )
