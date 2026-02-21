const DAY_MS = 86400000;

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function flattenDays(calendar) {
  const weeks = Array.isArray(calendar?.weeks) ? calendar.weeks : [];
  return weeks.flatMap((week) => (Array.isArray(week.days) ? week.days : []));
}

export function calculateStats(calendar, recentActivity) {
  const weekAgoIso = isoDaysAgo(7);
  const monthAgoIso = isoDaysAgo(30);
  const weekAgoDate = weekAgoIso.slice(0, 10);
  const monthAgoDate = monthAgoIso.slice(0, 10);

  const activity = Array.isArray(recentActivity) ? recentActivity : [];
  const commits = activity.filter((item) => item?.type === 'commit');

  const commitsThisWeek = commits.filter((item) => item.date >= weekAgoIso).length;
  const commitsThisMonth = commits.filter((item) => item.date >= monthAgoIso).length;

  const repositoriesThisWeek = new Set(
    activity
      .filter((item) => item?.date >= weekAgoIso)
      .map((item) => item.repo)
      .filter(Boolean),
  ).size;

  const days = flattenDays(calendar);
  const contributionsThisWeek = days
    .filter((day) => day.date >= weekAgoDate)
    .reduce((total, day) => total + Number(day.count || 0), 0);

  const contributionsThisMonth = days
    .filter((day) => day.date >= monthAgoDate)
    .reduce((total, day) => total + Number(day.count || 0), 0);

  return {
    commitsThisWeek,
    commitsThisMonth,
    contributionsThisWeek,
    contributionsThisMonth,
    repositoriesThisWeek,
  };
}
