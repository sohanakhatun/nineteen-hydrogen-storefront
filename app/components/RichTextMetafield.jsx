import { RichText } from '@shopify/hydrogen';
import React from 'react'

const RichTextMetafield = ({metafield}) => {
    if (!metafield?.value) {
        return null;
    }
  return (
    <RichText data={metafield?.value} />
   
  )
}

export default RichTextMetafield