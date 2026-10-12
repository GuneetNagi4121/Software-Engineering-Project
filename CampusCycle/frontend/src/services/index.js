import api, { TOKEN_KEY } from './api';

export const authApi = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data.user),
  updateProfile: (name) => api.patch('/auth/me', { name }).then((r) => r.data.user),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getToken: () => localStorage.getItem(TOKEN_KEY),
};

export const stationsApi = {
  /**
   * @param {object} [params] availability=GOOD|LOW|NONE|INACTIVE, status,
   *                          mapped=true, sort=availability|availability_desc
   */
  list: (params) => api.get('/stations', { params }).then((r) => r.data.stations),
  /** Stations with coordinates + the active campus boundary. */
  map: () => api.get('/stations/map').then((r) => r.data),
  get: (id) => api.get(`/stations/${id}`).then((r) => r.data.station),
  create: (payload) => api.post('/stations', payload).then((r) => r.data.station),
  update: (id, payload) => api.put(`/stations/${id}`, payload).then((r) => r.data.station),
  setStatus: (id, status) =>
    api.patch(`/stations/${id}/status`, { status }).then((r) => r.data.station),
  remove: (id) => api.delete(`/stations/${id}`).then((r) => r.data),
};

export const bicyclesApi = {
  list: (params) => api.get('/bicycles', { params }).then((r) => r.data.bicycles),
  get: (id) => api.get(`/bicycles/${id}`).then((r) => r.data.bicycle),
  stats: () => api.get('/bicycles/stats').then((r) => r.data.stats),
  create: (payload) => api.post('/bicycles', payload).then((r) => r.data.bicycle),
  update: (id, payload) => api.put(`/bicycles/${id}`, payload).then((r) => r.data.bicycle),
  changeStatus: (id, status, stationId) =>
    api
      .patch(`/bicycles/${id}/status`, { status, station_id: stationId })
      .then((r) => r.data.bicycle),
  remove: (id) => api.delete(`/bicycles/${id}`).then((r) => r.data),
};

export const rentalsApi = {
  start: (qrCode) => api.post('/rentals', { qr_code: qrCode }).then((r) => r.data.rental),
  active: () => api.get('/rentals/active').then((r) => r.data.rental),
  /** The signed-in student's own rides. @param {{status?:string}} [params] */
  mine: (params) => api.get('/rentals/me', { params }).then((r) => r.data.rentals),
  /** One ride — own ride for a student, any ride for an admin. */
  get: (id) => api.get(`/rentals/${id}`).then((r) => r.data.rental),
  returnRide: (id, endStationId) =>
    api.post(`/rentals/${id}/return`, { end_station_id: endStationId }).then((r) => r.data.rental),
  /** Admin: every ride, filtered + paginated. Returns { rentals, pagination }. */
  listAll: (params) => api.get('/rentals', { params }).then((r) => r.data),
};

export const maintenanceApi = {
  report: (payload) => api.post('/maintenance', payload).then((r) => r.data),
  mine: (params) => api.get('/maintenance/me', { params }).then((r) => r.data),
  get: (id) => api.get(`/maintenance/${id}`).then((r) => r.data.report),
  // Admin
  list: (params) => api.get('/maintenance', { params }).then((r) => r.data),
  stats: () => api.get('/maintenance/stats').then((r) => r.data.stats),
  updateStatus: (id, payload) =>
    api.patch(`/maintenance/${id}/status`, payload).then((r) => r.data),
};

export const analyticsApi = {
  /** @param {{from?:string,to?:string}} [params] YYYY-MM-DD */
  overview: (params) => api.get('/analytics', { params }).then((r) => r.data),
};

export const geofenceApi = {
  config: () => api.get('/geofence').then((r) => r.data),
  // Admin
  updateConfig: (payload) => api.put('/geofence', payload).then((r) => r.data.geofence),
  history: () => api.get('/geofence/history').then((r) => r.data.geofences),
  submitLocation: (payload) => api.post('/geofence/locations', payload).then((r) => r.data),
  locations: (params) => api.get('/geofence/locations', { params }).then((r) => r.data),
  latestLocations: () => api.get('/geofence/locations/latest').then((r) => r.data),
  events: (params) => api.get('/geofence/events', { params }).then((r) => r.data),
  eventStats: () => api.get('/geofence/events/stats').then((r) => r.data.stats),
  updateEvent: (id, payload) => api.patch(`/geofence/events/${id}`, payload).then((r) => r.data.event),
};

export const adminApi = {
  overview: () => api.get('/admin/overview').then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data.users),
};
