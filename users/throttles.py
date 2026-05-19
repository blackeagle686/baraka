from rest_framework.throttling import SimpleRateThrottle

class AuthAnonRateThrottle(SimpleRateThrottle):
    """
    Custom throttle to limit login and registration attempts from anonymous IPs.
    Applies the 'auth' scope configuration (10 requests per minute).
    """
    scope = 'auth'

    def get_cache_key(self, request, view):
        # If the user is authenticated, let standard UserRateThrottle apply
        if request.user and request.user.is_authenticated:
            return None
            
        # For anonymous users, track them by their IP address
        return self.get_ident(request)


class ChatbotUserRateThrottle(SimpleRateThrottle):
    """
    Custom throttle to limit chatbot API queries.
    Applies the 'chatbot' scope configuration (20 requests per minute).
    """
    scope = 'chatbot'

    def get_cache_key(self, request, view):
        # Limit chatbot requests by IP or user identifier
        if request.user and request.user.is_authenticated:
            return f"{self.scope}_{request.user.id}"
        return self.get_ident(request)
