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
  list: () => api.get('/stations').then((r) => r.data.stations),
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
  mine: () => api.get('/rentals/me').then((r) => r.data.rentals),
  returnRide: (id, endStationId) =>
    api.post(`/rentals/${id}/return`, { end_station_id: endStationId }).then((r) => r.data.rental),
  listAll: (params) => api.get('/rentals', { params }).then((r) => r.data.rentals),
};

export const adminApi = {
  overview: () => api.get('/admin/overview').then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data.users),
};
