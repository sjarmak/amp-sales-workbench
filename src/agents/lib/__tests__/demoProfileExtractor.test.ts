/**
 * Tests for Demo Profile Extraction
 */

import { describe, it, expect } from 'vitest'
import {
  extractDemoProfile,
  isValidDemoProfile,
  getDefaultDemoProfile,
  formatDemoProfile,
} from '../demoprofileExtractor.js'
import type { OpportunityContext } from '../../../agentTypes.js'

describe('Demo Profile Extractor', () => {
  describe('extractDemoProfile', () => {
    it('should extract languages from transcript', () => {
      const context: OpportunityContext = {
        accountId: 'test-1',
        accountName: 'Test Company',
        stage: 'qualification',
        products: [],
        salesforceSnapshot: {},
        activities: [],
        knowledgeDocs: [],
        artifacts: [],
        recentTranscript: [
          { speaker: 'Customer', text: 'We use Python and JavaScript heavily' },
          { speaker: 'Rep', text: 'Great, those are well-supported languages' },
        ],
      }

      const profile = extractDemoProfile(context)

      expect(profile.primaryLanguages.length).toBeGreaterThan(0)
      expect(
        profile.primaryLanguages.some((lang) =>
          ['python', 'javascript'].includes(lang.toLowerCase())
        )
      ).toBe(true)
    })

    it('should extract pain points from transcript', () => {
      const context: OpportunityContext = {
        accountId: 'test-2',
        accountName: 'Test Company',
        stage: 'qualification',
        products: [],
        salesforceSnapshot: {},
        activities: [],
        knowledgeDocs: [],
        artifacts: [],
        recentTranscript: [
          { speaker: 'Customer', text: 'Our main issue is code search across multiple repositories' },
          { speaker: 'Customer', text: 'Onboarding new engineers takes forever' },
        ],
      }

      const profile = extractDemoProfile(context)

      expect(profile.mainPainPoints.length).toBeGreaterThan(0)
      expect(
        profile.mainPainPoints.some(
          (pain) => pain === 'code-search' || pain === 'onboarding'
        )
      ).toBe(true)
    })

    it('should extract tools mentioned', () => {
      const context: OpportunityContext = {
        accountId: 'test-3',
        accountName: 'Test Company',
        stage: 'qualification',
        products: [],
        salesforceSnapshot: {},
        activities: [],
        knowledgeDocs: [],
        artifacts: [],
        recentTranscript: [
          { speaker: 'Customer', text: 'We host our code on GitHub and use Kubernetes' },
        ],
      }

      const profile = extractDemoProfile(context)

      expect(profile.toolsMentioned.length).toBeGreaterThan(0)
      expect(
        profile.toolsMentioned.some((tool) =>
          ['github', 'kubernetes'].includes(tool.toLowerCase())
        )
      ).toBe(true)
    })

    it('should infer persona from contact title', () => {
      const context: OpportunityContext = {
        accountId: 'test-4',
        accountName: 'Test Company',
        stage: 'qualification',
        products: [],
        salesforceSnapshot: {
          contacts: [
            {
              Name: 'John Doe',
              Title: 'Engineering Manager',
              Email: 'john@example.com',
            },
          ],
        },
        activities: [],
        knowledgeDocs: [],
        artifacts: [],
      }

      const profile = extractDemoProfile(context)

      expect(profile.persona).toBe('engineering_manager')
    })

    it('should handle empty context gracefully', () => {
      const context: OpportunityContext = {
        accountId: 'test-5',
        accountName: 'Test Company',
        stage: 'qualification',
        products: [],
        salesforceSnapshot: {},
        activities: [],
        knowledgeDocs: [],
        artifacts: [],
      }

      const profile = extractDemoProfile(context)

      expect(profile).toBeDefined()
      expect(profile.persona).toBe('other')
    })
  })

  describe('isValidDemoProfile', () => {
    it('should validate profile with languages', () => {
      const profile = {
        primaryLanguages: ['Python'],
        secondaryLanguages: [],
        mainPainPoints: [],
        toolsMentioned: [],
        useCases: [],
        persona: 'other' as const,
      }

      expect(isValidDemoProfile(profile)).toBe(true)
    })

    it('should validate profile with pain points', () => {
      const profile = {
        primaryLanguages: [],
        secondaryLanguages: [],
        mainPainPoints: ['code-search'],
        toolsMentioned: [],
        useCases: [],
        persona: 'other' as const,
      }

      expect(isValidDemoProfile(profile)).toBe(true)
    })

    it('should validate profile with use cases', () => {
      const profile = {
        primaryLanguages: [],
        secondaryLanguages: [],
        mainPainPoints: [],
        toolsMentioned: [],
        useCases: ['code-exploration'],
        persona: 'other' as const,
      }

      expect(isValidDemoProfile(profile)).toBe(true)
    })

    it('should reject empty profile', () => {
      const profile = {
        primaryLanguages: [],
        secondaryLanguages: [],
        mainPainPoints: [],
        toolsMentioned: [],
        useCases: [],
        persona: 'other' as const,
      }

      expect(isValidDemoProfile(profile)).toBe(false)
    })
  })

  describe('getDefaultDemoProfile', () => {
    it('should return a valid default profile', () => {
      const profile = getDefaultDemoProfile()

      expect(isValidDemoProfile(profile)).toBe(true)
      expect(profile.primaryLanguages.length).toBeGreaterThan(0)
    })

    it('should include Python in defaults', () => {
      const profile = getDefaultDemoProfile()

      expect(profile.primaryLanguages.includes('Python')).toBe(true)
    })
  })

  describe('formatDemoProfile', () => {
    it('should format profile as readable string', () => {
      const profile = {
        primaryLanguages: ['Python'],
        secondaryLanguages: ['JavaScript'],
        mainPainPoints: ['code-search'],
        toolsMentioned: ['github'],
        useCases: ['code-exploration'],
        persona: 'dev' as const,
      }

      const formatted = formatDemoProfile(profile)

      expect(formatted).toContain('Python')
      expect(formatted).toContain('JavaScript')
      expect(formatted).toContain('code-search')
      expect(formatted).toContain('github')
      expect(formatted).toContain('code-exploration')
      expect(formatted).toContain('dev')
    })
  })
})
