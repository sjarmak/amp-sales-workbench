/**
 * Tests for ADS Repository Selector
 */

import { describe, it, expect } from 'vitest'
import {
  selectAdsDemoRepos,
  isValidRepoUrl,
  normalizeRepoUrl,
  generateExampleQueries,
} from '../adsRepositorySelector.js'
import type { DemoProfile } from '../demoprofileExtractor.js'

describe('ADS Repository Selector', () => {
  describe('selectAdsDemoRepos', () => {
    it('should select repos for Python profile', () => {
      const profile: DemoProfile = {
        primaryLanguages: ['Python'],
        secondaryLanguages: [],
        mainPainPoints: ['code-search'],
        toolsMentioned: ['github'],
        useCases: ['code-exploration'],
        persona: 'dev',
      }

      const selected = selectAdsDemoRepos(profile)

      expect(selected.length).toBeGreaterThan(0)
      expect(selected[0].url).toContain('github.com/adsabs')
    })

    it('should select repos for JavaScript profile', () => {
      const profile: DemoProfile = {
        primaryLanguages: ['JavaScript', 'TypeScript'],
        secondaryLanguages: [],
        mainPainPoints: ['onboarding'],
        toolsMentioned: ['github'],
        useCases: ['frontend-development'],
        persona: 'dev',
      }

      const selected = selectAdsDemoRepos(profile)

      expect(selected.length).toBeGreaterThan(0)
      expect(selected[0].rationale).toBeTruthy()
    })

    it('should include rationale for selection', () => {
      const profile: DemoProfile = {
        primaryLanguages: ['Python'],
        secondaryLanguages: [],
        mainPainPoints: [],
        toolsMentioned: [],
        useCases: [],
        persona: 'dev',
      }

      const selected = selectAdsDemoRepos(profile)

      for (const repo of selected) {
        expect(repo.rationale).toBeTruthy()
        expect(repo.rationale.length).toBeGreaterThan(0)
      }
    })

    it('should return at most 3 repos', () => {
      const profile: DemoProfile = {
        primaryLanguages: ['Python', 'Go', 'JavaScript'],
        secondaryLanguages: [],
        mainPainPoints: ['code-search', 'refactoring', 'debugging'],
        toolsMentioned: ['github', 'kubernetes', 'docker'],
        useCases: ['code-exploration', 'scalability', 'infrastructure'],
        persona: 'dev',
      }

      const selected = selectAdsDemoRepos(profile)

      expect(selected.length).toBeLessThanOrEqual(3)
    })

    it('should return at least 1 repo with valid profile', () => {
      const profile: DemoProfile = {
        primaryLanguages: ['Python'],
        secondaryLanguages: [],
        mainPainPoints: [],
        toolsMentioned: [],
        useCases: [],
        persona: 'other',
      }

      const selected = selectAdsDemoRepos(profile)

      expect(selected.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('isValidRepoUrl', () => {
    it('should accept valid GitHub URLs', () => {
      expect(isValidRepoUrl('https://github.com/adsabs/adsabs-core')).toBe(true)
      expect(isValidRepoUrl('https://github.com/adsabs/ADSimport')).toBe(true)
      expect(isValidRepoUrl('https://github.com/user/repo-name')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(isValidRepoUrl('https://gitlab.com/adsabs/adsabs-core')).toBe(false)
      expect(isValidRepoUrl('github.com/adsabs/adsabs-core')).toBe(false)
      expect(isValidRepoUrl('not-a-url')).toBe(false)
    })
  })

  describe('normalizeRepoUrl', () => {
    it('should remove trailing slashes', () => {
      const normalized = normalizeRepoUrl('https://github.com/adsabs/adsabs-core/')
      expect(normalized).toBe('https://github.com/adsabs/adsabs-core')
    })

    it('should convert http to https', () => {
      const normalized = normalizeRepoUrl('http://github.com/adsabs/adsabs-core')
      expect(normalized).toContain('https://')
    })

    it('should handle empty strings', () => {
      const normalized = normalizeRepoUrl('')
      expect(normalized).toBe('')
    })
  })

  describe('generateExampleQueries', () => {
    it('should generate queries for Python repo', () => {
      const repo = {
        url: 'https://github.com/adsabs/adsabs-core',
        name: 'adsabs-core',
        description: 'Test repo',
        languages: ['Python', 'JavaScript'],
        rationale: 'Test rationale',
      }

      const profile: DemoProfile = {
        primaryLanguages: ['Python'],
        secondaryLanguages: [],
        mainPainPoints: [],
        toolsMentioned: [],
        useCases: [],
        persona: 'dev',
      }

      const queries = generateExampleQueries(repo, profile)

      expect(queries.length).toBeGreaterThan(0)
      expect(queries.every((q) => q.query && q.description)).toBe(true)
    })

    it('should generate pain-specific queries', () => {
      const repo = {
        url: 'https://github.com/adsabs/adsabs-core',
        name: 'adsabs-core',
        description: 'Test repo',
        languages: ['Python'],
        rationale: 'Test rationale',
      }

      const profile: DemoProfile = {
        primaryLanguages: ['Python'],
        secondaryLanguages: [],
        mainPainPoints: ['api-discovery', 'security'],
        toolsMentioned: [],
        useCases: [],
        persona: 'dev',
      }

      const queries = generateExampleQueries(repo, profile)

      expect(queries.length).toBeGreaterThan(0)
      const queriesText = queries.map((q) => q.description).join(' ')
      expect(queriesText).toContain('API')
    })

    it('should not return empty query list', () => {
      const repo = {
        url: 'https://github.com/adsabs/adsabs-core',
        name: 'adsabs-core',
        description: 'Test repo',
        languages: [],
        rationale: 'Test rationale',
      }

      const profile: DemoProfile = {
        primaryLanguages: [],
        secondaryLanguages: [],
        mainPainPoints: [],
        toolsMentioned: [],
        useCases: [],
        persona: 'other',
      }

      const queries = generateExampleQueries(repo, profile)

      expect(queries.length).toBeGreaterThan(0)
    })
  })
})
