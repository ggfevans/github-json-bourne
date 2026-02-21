function fail(path, detail) {
  throw new Error(`Schema validation failed at ${path}: ${detail}`);
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'expected object');
  }
}

function assertNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'expected finite number');
  }
}

function assertString(value, path) {
  if (typeof value !== 'string') {
    fail(path, 'expected string');
  }
}

function assertArray(value, path) {
  if (!Array.isArray(value)) {
    fail(path, 'expected array');
  }
}

export function validate(data) {
  assertObject(data, 'root');

  const requiredTopLevel = [
    'lastUpdated',
    'contributions',
    'calendar',
    'streak',
    'recentActivity',
    'stats',
    'repositories',
  ];

  for (const key of requiredTopLevel) {
    if (!(key in data)) {
      fail('root', `missing key "${key}"`);
    }
  }

  assertString(data.lastUpdated, 'lastUpdated');

  assertObject(data.contributions, 'contributions');
  assertNumber(data.contributions.total, 'contributions.total');
  assertNumber(data.contributions.commits, 'contributions.commits');
  assertNumber(data.contributions.pullRequests, 'contributions.pullRequests');
  assertNumber(data.contributions.pullRequestReviews, 'contributions.pullRequestReviews');
  assertNumber(data.contributions.issues, 'contributions.issues');
  assertNumber(data.contributions.restricted, 'contributions.restricted');

  assertObject(data.calendar, 'calendar');
  assertArray(data.calendar.weeks, 'calendar.weeks');
  data.calendar.weeks.forEach((week, weekIndex) => {
    assertObject(week, `calendar.weeks[${weekIndex}]`);
    assertArray(week.days, `calendar.weeks[${weekIndex}].days`);
    week.days.forEach((day, dayIndex) => {
      const basePath = `calendar.weeks[${weekIndex}].days[${dayIndex}]`;
      assertObject(day, basePath);
      assertString(day.date, `${basePath}.date`);
      assertNumber(day.count, `${basePath}.count`);
      assertNumber(day.level, `${basePath}.level`);
      if (day.level < 0 || day.level > 4) {
        fail(`${basePath}.level`, 'expected value between 0 and 4');
      }
    });
  });

  assertObject(data.streak, 'streak');
  assertNumber(data.streak.current, 'streak.current');
  assertNumber(data.streak.longest, 'streak.longest');
  if (typeof data.streak.today !== 'boolean') {
    fail('streak.today', 'expected boolean');
  }

  assertArray(data.recentActivity, 'recentActivity');
  data.recentActivity.forEach((item, index) => {
    const basePath = `recentActivity[${index}]`;
    assertObject(item, basePath);

    if (!['commit', 'pr', 'issue'].includes(item.type)) {
      fail(`${basePath}.type`, 'expected commit, pr, or issue');
    }

    assertString(item.repo, `${basePath}.repo`);
    assertString(item.repoUrl, `${basePath}.repoUrl`);
    assertString(item.title, `${basePath}.title`);
    assertString(item.url, `${basePath}.url`);
    assertString(item.date, `${basePath}.date`);

    if (item.meta != null) {
      assertObject(item.meta, `${basePath}.meta`);
      if ('commitCount' in item.meta) {
        assertNumber(item.meta.commitCount, `${basePath}.meta.commitCount`);
      }
      if ('state' in item.meta) {
        assertString(item.meta.state, `${basePath}.meta.state`);
      }
      if ('merged' in item.meta && typeof item.meta.merged !== 'boolean') {
        fail(`${basePath}.meta.merged`, 'expected boolean');
      }
    }
  });

  assertObject(data.stats, 'stats');
  assertNumber(data.stats.commitsThisWeek, 'stats.commitsThisWeek');
  assertNumber(data.stats.commitsThisMonth, 'stats.commitsThisMonth');
  assertNumber(data.stats.contributionsThisWeek, 'stats.contributionsThisWeek');
  assertNumber(data.stats.contributionsThisMonth, 'stats.contributionsThisMonth');
  assertNumber(data.stats.repositoriesThisWeek, 'stats.repositoriesThisWeek');

  assertArray(data.repositories, 'repositories');
  data.repositories.forEach((repo, index) => {
    const basePath = `repositories[${index}]`;
    assertObject(repo, basePath);
    assertString(repo.name, `${basePath}.name`);
    assertString(repo.url, `${basePath}.url`);
    assertString(repo.description, `${basePath}.description`);
    assertString(repo.language, `${basePath}.language`);
    assertString(repo.languageColor, `${basePath}.languageColor`);
    assertNumber(repo.stars, `${basePath}.stars`);
  });

  return true;
}
