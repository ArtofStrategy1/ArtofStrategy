from fastapi import Request


def get_nlp_model(request: Request):
    return request.app.state.nlp
