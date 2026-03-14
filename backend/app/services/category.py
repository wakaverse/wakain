"""Category ID resolution from recipe_json."""

_CATEGORY_KO_TO_ID = {
    "식품": "food", "전자제품": "electronics", "뷰티": "beauty",
    "패션": "fashion", "건강": "health", "건강/의료": "health",
    "생활": "home", "생활/가전": "home", "스포츠": "sports",
    "스포츠/레저": "sports", "교육": "education", "금융": "finance",
    "금융/보험": "finance", "여행": "travel", "유아": "kids",
    "유아/아동": "kids", "반려동물": "pet", "자동차": "auto",
    "엔터테인먼트": "entertainment",
}


def _resolve_category_id(recipe_json: dict) -> str | None:
    """recipe_json에서 카테고리 ID를 추출."""
    identity = recipe_json.get("identity", {})
    cat_ko = identity.get("category_ko", "")
    if not cat_ko:
        return None
    # 정확 매칭
    if cat_ko in _CATEGORY_KO_TO_ID:
        return _CATEGORY_KO_TO_ID[cat_ko]
    # 부분 매칭
    for k, v in _CATEGORY_KO_TO_ID.items():
        if k in cat_ko or cat_ko in k:
            return v
    return "other"
