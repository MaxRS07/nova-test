import logging
import traceback
import os
from typing import Optional

from nova_act import NovaAct
from nova_act.tools.human.interface.human_input_callback import HumanInputCallbacksBase

from nova.types import Agent
from nova.guardrails import autopass_guardrail

logger = logging.getLogger(__name__)

KEY = os.getenv("NOVA_ACT_API_KEY")


def create_agent(
    url: str,
    human_callback: Optional[HumanInputCallbacksBase] = None,
    agent_config: Optional[Agent] = None,
) -> NovaAct:
    """
    Create a Nova Act agent with optional human callback for approvals.

    Args:
        url: Starting page URL
        human_callback: Optional callback for human approval handling
        agent_config: Optional agent configuration

    Returns:
        NovaAct: Initialized Nova Act agent

    Raises:
        ValueError: If API key is missing
        Exception: If agent creation fails
    """
    try:
        if not KEY:
            raise ValueError("NOVA_ACT_API_KEY environment variable is not set")

        logger.info(f"Creating Nova Act agent for URL: {url}")
        act = NovaAct(
            nova_act_api_key=KEY,
            starting_page=url,
            human_input_callbacks=human_callback,
            state_guardrail=autopass_guardrail,
        )
        logger.info("Nova Act agent created successfully")
        return act
    except ValueError as ve:
        logger.error(f"Configuration error: {str(ve)}")
        raise
    except Exception as e:
        logger.error(f"Error creating Nova Act agent: {str(e)}")
        logger.debug(traceback.format_exc())
        raise Exception(f"Failed to create Nova Act agent: {str(e)}")
