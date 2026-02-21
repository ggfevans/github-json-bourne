import { graphql } from '@octokit/graphql';

const CONTRIBUTION_LEVEL_MAP = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const QUERY = `
  query($user: String!) {
    user(login: $user) {
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

function mapLevel(level) {
  return CONTRIBUTION_LEVEL_MAP[level] ?? 0;
}

export async function fetchContributions(username, token) {
  const client = graphql.defaults({
    headers: {
      authorization: `bearer ${token}`,
    },
  });

  let collection;
  try {
    const response = await client(QUERY, { user: username });
    collection = response?.user?.contributionsCollection;
  } catch (error) {
    throw new Error(`GraphQL contributions query failed: ${error.message}`);
  }

  if (!collection) {
    return {
      contributions: {
        total: 0,
        commits: 0,
        pullRequests: 0,
        pullRequestReviews: 0,
        issues: 0,
        restricted: 0,
      },
      calendar: { weeks: [] },
    };
  }

  const contributions = {
    total: Number(collection.contributionCalendar?.totalContributions ?? 0),
    commits: Number(collection.totalCommitContributions ?? 0),
    pullRequests: Number(collection.totalPullRequestContributions ?? 0),
    pullRequestReviews: Number(collection.totalPullRequestReviewContributions ?? 0),
    issues: Number(collection.totalIssueContributions ?? 0),
    restricted: Number(collection.restrictedContributionsCount ?? 0),
  };

  const weeks = Array.isArray(collection.contributionCalendar?.weeks)
    ? collection.contributionCalendar.weeks.map((week) => ({
        days: Array.isArray(week.contributionDays)
          ? week.contributionDays.map((day) => ({
              date: day.date,
              count: Number(day.contributionCount ?? 0),
              level: mapLevel(day.contributionLevel),
            }))
          : [],
      }))
    : [];

  return {
    contributions,
    calendar: { weeks },
  };
}
