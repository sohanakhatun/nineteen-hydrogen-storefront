import {useLoaderData} from 'react-router';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductImage} from '~/components/ProductImage';
import {ProductForm} from '~/components/ProductForm';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import RichTextMetafield from '~/components/RichTextMetafield';
import UspPointers from '~/components/UspPointers';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [
    {title: `Hydrogen | ${data?.product.title ?? ''}`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, params, request}) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context, params}) {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  return {};
}

export default function Product() {
  /** @type {LoaderReturnData} */
  const {product} = useLoaderData();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml, images, metafields, metafield} = product;

  const productDescriptionMetafield = metafields.find(
    (m) => m?.key === 'product_description' && m?.namespace === 'custom',
  );

  const modelDetailsMetafield = metafields.find(
    (m) => m?.key === 'model_details' && m?.namespace === 'custom',
  );

  const uspPointersMetafield =
    metafield?.key === 'usp_pointers' && metafield?.references?.edges.length > 0
      ? metafield
      : null;

  return (
    <div className="product">
      <div className="product-gallery">
        {images.edges.map(({node}) => (
          <ProductImage key={node.id} image={node} />
        ))}
      </div>
      <div className="product-main flex flex-col gap-3">
        <h1>{title}</h1>
        <ProductPrice
          price={selectedVariant?.price}
          compareAtPrice={selectedVariant?.compareAtPrice}
        />
        <ProductForm
          productOptions={productOptions}
          selectedVariant={selectedVariant}
        />
        {modelDetailsMetafield && (
          <section className="flex flex-col gap-3">
            <p>
              <strong className="underline underline-offset-2">
                Model Details
              </strong>
            </p>
            <RichTextMetafield metafield={modelDetailsMetafield} />
          </section>
        )}

        {productDescriptionMetafield && (
          <section className="flex flex-col gap-3">
            <p>
              <strong className="underline underline-offset-2">
                Product Specifications
              </strong>
            </p>
            <RichTextMetafield metafield={productDescriptionMetafield} />
          </section>
        )}

        {uspPointersMetafield && (
          <section className="flex flex-col gap-3">
            <p>
              <strong className="underline underline-offset-2">
                Usp Pointers
              </strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {uspPointersMetafield.references.edges.map((edge) => {
                return (
                  <UspPointers key={edge.node.id} fields={edge.node.fields} />
                );
              })}
            </div>
          </section>
        )}

        {descriptionHtml && (
          <section className="flex flex-col gap-3">
            <p>
              <strong className="underline underline-offset-2">
                Description
              </strong>
            </p>
            <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
          </section>
        )}
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
`;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    images(first: 20) {
      edges {
        node {
          id
          altText
          url
          width
          height
        }
      }
    }
  metafields(identifiers: [
  { namespace: "custom", key: "model_details" },
  { namespace: "custom", key: "product_description" },
   {namespace: "custom", key: "fabric_details" },
]) {
  value
  type
  key
  namespace
}
metafield(namespace: "custom", key: "usp_pointers") {
  value
  type
  key
  references(first: 10) {
    edges {
      node {
        ... on Metaobject {
          id
          type
          fields {
            key
            value
            type
            reference {
              ... on MediaImage {
                image {
                  url
                  altText
                  width
                  height
                }
              }
            }
          }
        }
      }
    }
  }
}
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants(selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
`;

/** @typedef {import('./+types/products.$handle').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
