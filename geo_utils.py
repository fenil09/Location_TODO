import math
import math

EARTH_RADIUS_METERS = 6371000.0


def haversin_distance(lat1:float,lon1:float,lat2:float,lon2:float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2-lat1)
    delta_lambda = math.radians(lon2-lon1)


    # applying the haversine formulat
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return EARTH_RADIUS_METERS*c



def iswithin_radius(user_lat:float,user_lng:float,target_lat:float,target_lng:float,radius_meters:float) -> tuple[bool,float]:

    distance = haversin_distance(user_lat,user_lng,target_lat,target_lng)
    is_inside = distance <= radius_meters
    return is_inside,round(distance,1)




    

