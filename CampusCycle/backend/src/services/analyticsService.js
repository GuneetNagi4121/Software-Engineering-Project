'use strict';

const analyticsModel = require('../models/analyticsModel');
const stationModel = require('../models/stationModel');
const ApiError = require('../utils/ApiError');

/**
 * Usage analytics for administrators.
 *
 * Every number comes from a PostgreSQL aggregate over the live tables.
 * The response separates:
 *   lifetime — snapshot / all-time figures, NOT affected by the date filter
 *   range    — figures for the selected date range only
 * so the dashboard can label them honestly.
 */

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366 * 3;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseBoundary(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  // A date-only value is interpreted in the server's local timezone, so
  // "2026-10-12" means that whole local day.
  const parsed = DATE_ONLY.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest(`Invalid ${field} date`, { [field]: 'Use YYYY-MM-DD' });
  }
  return { date: parsed, dateOnly: DATE_ONLY.test(raw) };
}

/**
 * Resolve ?from= / ?to= into a half-open [from, to) instant pair.
 * `to` is pushed to the end of its day so the range is inclusive of it.
 */
function resolveRange({ from, to } = {}) {
  const parsedFrom = parseBoundary(from, 'from');
  const parsedTo = parseBoundary(to, 'to');

  let end;
  if (parsedTo) {
    end = parsedTo.dateOnly
      ? new Date(startOfDay(parsedTo.date).getTime() + 24 * 60 * 60 * 1000)
      : parsedTo.date;
  } else {
    end = new Date(startOfDay(new Date()).getTime() + 24 * 60 * 60 * 1000);
  }

  let start;
  if (parsedFrom) {
    start = parsedFrom.dateOnly ? startOfDay(parsedFrom.date) : parsedFrom.date;
  } else {
    start = new Date(end.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  }

  if (start >= end) {
    throw ApiError.badRequest('The "from" date must be before the "to" date', {
      from: 'Must be earlier than "to"',
    });
  }

  const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
  if (days > MAX_RANGE_DAYS) {
    throw ApiError.badRequest(`Date range cannot exceed ${MAX_RANGE_DAYS} days`, {
      from: 'Range too large',
    });
  }

  return { from: start, to: end, days };
}

function minutes(seconds) {
  if (seconds === null || seconds === undefined) return null;
  return Math.round((Number(seconds) / 60) * 10) / 10;
}

async function overview(query = {}) {
  const range = resolveRange(query);

  const [lifetime, rangeTotals, overTime, byStation, statusDist, byHour, topBikes, maintenance, stations] =
    await Promise.all([
      analyticsModel.lifetimeTotals(),
      analyticsModel.rangeTotals(range),
      analyticsModel.rentalsOverTime(range),
      analyticsModel.rentalsByStation(range),
      analyticsModel.bicycleStatusDistribution(),
      analyticsModel.usageByHour(range),
      analyticsModel.topBicycles({ ...range, limit: 5 }),
      analyticsModel.maintenanceBreakdown(range),
      stationModel.listWithCounts(),
    ]);

  // Fleet utilisation: share of the fleet currently out on a ride.
  const totalBikes = lifetime.total_bicycles || 0;
  const utilisationPct =
    totalBikes > 0 ? Math.round((lifetime.in_use_bicycles / totalBikes) * 1000) / 10 : 0;

  const totalCapacity = stations.reduce((sum, s) => sum + (s.capacity || 0), 0);
  const totalAvailable = stations.reduce((sum, s) => sum + (s.available_count || 0), 0);

  return {
    generated_at: new Date().toISOString(),
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      days: range.days,
    },
    // Snapshot / all-time — NOT filtered by the date range.
    lifetime: {
      ...lifetime,
      avg_completed_minutes: minutes(lifetime.avg_completed_seconds),
      fleet_utilisation_pct: utilisationPct,
      total_capacity: totalCapacity,
      total_available_at_stations: totalAvailable,
      network_availability_pct:
        totalCapacity > 0 ? Math.round((totalAvailable / totalCapacity) * 1000) / 10 : 0,
    },
    // Only rides that started inside the selected range.
    period: {
      ...rangeTotals,
      avg_completed_minutes: minutes(rangeTotals.avg_completed_seconds),
      total_completed_minutes: minutes(rangeTotals.total_completed_seconds),
      rides_per_day:
        range.days > 0 ? Math.round((rangeTotals.rides_started / range.days) * 10) / 10 : 0,
    },
    charts: {
      rentalsOverTime: overTime,
      rentalsByStation: byStation,
      bicycleStatus: statusDist,
      usageByHour: byHour,
      maintenanceByCategory: maintenance.byCategory,
      maintenanceByStatus: maintenance.byStatus,
      maintenanceBySeverity: maintenance.bySeverity,
    },
    leaderboards: {
      topStations: byStation.filter((s) => s.total_trips > 0).slice(0, 5),
      topBicycles: topBikes.map((b) => ({ ...b, avg_minutes: minutes(b.avg_seconds) })),
    },
  };
}

module.exports = { overview, resolveRange };
