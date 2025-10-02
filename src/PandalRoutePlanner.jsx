import React, { useEffect, useRef, useState } from "react";
import { Navigation, MapPin, Trash2, Route, Clock, Maximize2 } from "lucide-react";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;


export default function PandalRoutePlanner() {
  const [map, setMap] = useState(null);
  const [places, setPlaces] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef(null);
  const markers = useRef([]);

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => initMap();
      document.body.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  const initMap = () => {
    const mapInstance = new window.google.maps.Map(document.getElementById("map"), {
      center: { lat: 22.5726, lng: 88.3639 },
      zoom: 12,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }]
        }
      ]
    });
    setMap(mapInstance);

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "in" }
    });
    
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;
      
      const newPlace = {
        name: place.name || place.formatted_address,
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      
      setPlaces((prev) => [...prev, newPlace]);
      
      const marker = new window.google.maps.Marker({
        map: mapInstance,
        position: place.geometry.location,
        label: String(places.length + 1),
        animation: window.google.maps.Animation.DROP
      });
      
      markers.current.push(marker);
      mapInstance.panTo(place.geometry.location);
      inputRef.current.value = "";
    });
  };

  const removePlace = (index) => {
    setPlaces((prev) => prev.filter((_, i) => i !== index));
    if (markers.current[index]) {
      markers.current[index].setMap(null);
    }
    markers.current = markers.current.filter((_, i) => i !== index);
    markers.current.forEach((marker, i) => {
      marker.setLabel(String(i + 1));
    });
    setResult(null);
  };

  const clearAll = () => {
    setPlaces([]);
    setResult(null);
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = [];
  };

  const tsp = (matrix) => {
    const n = matrix.length;
    let minCost = Infinity;
    let bestPath = [];

    function permute(path, visited, cost) {
      if (path.length === n) {
        cost += matrix[path[path.length - 1]][0];
        if (cost < minCost) {
          minCost = cost;
          bestPath = [...path, 0];
        }
        return;
      }
      for (let i = 0; i < n; i++) {
        if (!visited[i]) {
          visited[i] = true;
          permute([...path, i], visited, cost + matrix[path[path.length - 1]][i]);
          visited[i] = false;
        }
      }
    }

    const visited = Array(n).fill(false);
    visited[0] = true;
    permute([0], visited, 0);

    return { minCost, bestPath };
  };

  const calculateRoute = async () => {
    if (places.length < 2) {
      alert("Please add at least 2 pandal locations!");
      return;
    }

    setLoading(true);
    const origins = places.map((p) => new window.google.maps.LatLng(p.lat, p.lng));

    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins,
        destinations: origins,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        setLoading(false);
        if (status !== "OK") {
          alert("Error calculating route: " + status);
          return;
        }
        
        const n = places.length;
        const distMatrix = Array.from({ length: n }, () => Array(n).fill(0));
        const timeMatrix = Array.from({ length: n }, () => Array(n).fill(0));

        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i === j) continue;
            distMatrix[i][j] = response.rows[i].elements[j].distance.value / 1000;
            timeMatrix[i][j] = response.rows[i].elements[j].duration.value / 60;
          }
        }

        const bestDist = tsp(distMatrix);
        const bestTime = tsp(timeMatrix);

        setResult({
          byDistance: {
            path: bestDist.bestPath,
            total: bestDist.minCost
          },
          byTime: {
            path: bestTime.bestPath,
            total: bestTime.minCost
          }
        });
        setIsExpanded(true);
      }
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Navigation className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Pandal Route Planner</h1>
              <p className="text-orange-100 text-sm">Optimize your Durga Puja pandal visits</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for pandal locations..."
                className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <button
              onClick={calculateRoute}
              disabled={places.length < 2 || loading}
              className="bg-white text-orange-600 px-6 py-3 rounded-lg font-semibold hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Route className="w-5 h-5" />
              {loading ? "Calculating..." : "Optimize Route"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`bg-white shadow-lg transition-all duration-300 overflow-y-auto ${isExpanded && result ? 'w-96' : 'w-80'}`}>
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg text-gray-800">
                Selected Pandals ({places.length})
              </h2>
              {places.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>

            {places.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Search and add pandal locations to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {places.map((place, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">
                          {place.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{place.address}</p>
                      </div>
                      <button
                        onClick={() => removePlace(i)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="mt-6 space-y-4">
                <div className="border-t pt-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Route className="w-5 h-5 text-orange-500" />
                    Shortest Distance Route
                  </h3>
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                      {result.byDistance.total.toFixed(2)} km
                    </div>
                    <div className="space-y-1">
                      {result.byDistance.path.map((idx, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="text-gray-700">{places[idx].name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    Fastest Time Route
                  </h3>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {result.byTime.total.toFixed(0)} mins
                    </div>
                    <div className="space-y-1">
                      {result.byTime.path.map((idx, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="text-gray-700">{places[idx].name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div id="map" className="w-full h-full"></div>
        </div>
      </div>
    </div>
  );
}