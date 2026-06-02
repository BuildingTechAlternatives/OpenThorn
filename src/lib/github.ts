const GITHUB_API = 'https://api.github.com'

interface GitHubRepo {
  html_url: string
  clone_url: string
  name: string
  owner: { login: string }
}

export async function getGitHubUser(token: string): Promise<{ login: string }> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    throw new Error('Invalid GitHub token')
  }

  return res.json()
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean,
): Promise<GitHubRepo> {
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || res.statusText)
  }

  return res.json()
}

export async function pushFiles(
  token: string,
  owner: string,
  repo: string,
  files: { path: string; content: string }[],
): Promise<void> {
  for (const file of files) {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(file.content)
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    const base64 = btoa(binary)

    const res = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${file.path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `Add ${file.path}`,
          content: base64,
        }),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(`Push ${file.path}: ${err.message || res.statusText}`)
    }
  }
}
