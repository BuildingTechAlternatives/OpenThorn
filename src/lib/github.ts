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
  description: string,
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
      description,
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

async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.sha ?? null
}

export async function syncFiles(
  token: string,
  owner: string,
  repo: string,
  files: { path: string; content: string }[],
  commitMessage: string = 'Update project files',
): Promise<void> {
  for (const file of files) {
    const sha = await getFileSha(token, owner, repo, file.path)
    const encoder = new TextEncoder()
    const bytes = encoder.encode(file.content)
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    const base64 = btoa(binary)

    const body: Record<string, unknown> = { message: commitMessage, content: base64 }
    if (sha) body.sha = sha

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
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(`Sync ${file.path}: ${err.message || res.statusText}`)
    }
  }
}
