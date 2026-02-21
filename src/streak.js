function flattenDays(calendar) {
  const weeks = Array.isArray(calendar?.weeks) ? calendar.weeks : [];
  return weeks.flatMap((week) => (Array.isArray(week.days) ? week.days : []));
}

export function calculateStreak(calendar) {
  const days = flattenDays(calendar).sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date().toISOString().slice(0, 10);

  const todayHasContributions = Boolean(days[0] && days[0].date === today && days[0].count > 0);

  let current = 0;
  for (const day of days) {
    if (day.count > 0) {
      current += 1;
      continue;
    }

    // If today's count is still zero, do not break the streak yet.
    if (current === 0 && day.date === today) {
      continue;
    }

    break;
  }

  const ascendingDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let rolling = 0;
  let longest = 0;

  for (const day of ascendingDays) {
    if (day.count > 0) {
      rolling += 1;
      if (rolling > longest) {
        longest = rolling;
      }
    } else {
      rolling = 0;
    }
  }

  return {
    current,
    longest,
    today: todayHasContributions,
  };
}
