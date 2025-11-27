import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import homeAddressPng from "../assets/home-address.png?url";
import shipmentPng from "../assets/shipment.png?url";

// Fix for default marker icons not showing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


// Custom Icons as a function
export const getCustomIcons = (L) => {
  return {
    houseIcon: new L.Icon({
      iconUrl: homeAddressPng,
      shadowUrl: '',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    }),

    garbageTruckIcon: new L.Icon({
      iconUrl: shipmentPng,
      shadowUrl: '',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    }),

    assignedDriverIcon: new L.Icon({
      iconUrl: shipmentPng,
      shadowUrl: '',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    }),

    emergencyHouseIcon: new L.Icon({
      iconUrl: homeAddressPng,
      shadowUrl: '',
      iconSize: [35, 51], // Larger
      iconAnchor: [17, 51],
      popupAnchor: [1, -44],
      shadowSize: [51, 51]
    }),

    emergencyDriverIcon: new L.Icon({
      iconUrl: shipmentPng,
      shadowUrl: '',
      iconSize: [35, 51], // Larger
      iconAnchor: [17, 51],
      popupAnchor: [1, -44],
      shadowSize: [51, 51]
    })
  };
};

const MapComponent = ({ center, zoom, markers }) => {
  const mapRef = useRef();

  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} ref={mapRef}>
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers && markers.map((marker, index) => (
        <Marker key={index} position={marker.position} icon={marker.icon}>
          {marker.popupText && <Popup>{marker.popupText}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;
