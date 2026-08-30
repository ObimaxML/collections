from fastapi import APIRouter, HTTPException

from app.schemas.strategies import StrategyResponse
from app.services.collection_strategies import (
    STRATEGIES,
    get_strategy,
)


router = APIRouter(
    prefix="/strategies",
    tags=["Collection Strategies"],
)


@router.get(
    "",
    response_model=list[StrategyResponse],
)
def list_strategies():

    return [
        StrategyResponse(
            code=strategy.code,
            name=strategy.name,
            description=strategy.description,
            recommended_actions=list(
                strategy.recommended_actions
            ),
            follow_up_days=strategy.follow_up_days,
            escalation_days=strategy.escalation_days,
        )
        for strategy in STRATEGIES.values()
    ]


@router.get(
    "/{strategy_code}",
    response_model=StrategyResponse,
)
def get_strategy_details(
    strategy_code: str,
):

    strategy = get_strategy(strategy_code)

    if not strategy:
        raise HTTPException(
            status_code=404,
            detail="Collection strategy not found",
        )

    return StrategyResponse(
        code=strategy.code,
        name=strategy.name,
        description=strategy.description,
        recommended_actions=list(
            strategy.recommended_actions
        ),
        follow_up_days=strategy.follow_up_days,
        escalation_days=strategy.escalation_days,
    )
