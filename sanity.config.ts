import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schema'

export default defineConfig({
  name: 'default',
  title: '서울집주인',
  projectId: '4rap3fus',
  dataset: 'production',
  basePath: '/studio',
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
})
