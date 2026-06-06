import { type SchemaTypeDefinition } from 'sanity'
import {blockContentType} from './blockContentType'
import {categoryType} from './categoryType'
import {pageCategoryType} from './pageCategoryType'
import {postType} from './postType'
import {authorType} from './authorType'
import {pageType} from './page'
import {homepageType} from './homepage' 
import mosaicCard from './mosaicCard'
import destinationCard from './destinationCard'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    blockContentType, 
    categoryType, 
    pageCategoryType,
    postType, 
    authorType, 
    pageType,
    homepageType,
    mosaicCard,
    destinationCard,
  ],
}