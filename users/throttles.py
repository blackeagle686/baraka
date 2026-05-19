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
