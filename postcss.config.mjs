// Next.js searches parent folders for a PostCSS config, so this file pins the
// project to Next's built-in defaults instead of picking up a stray config
// from a parent directory. It mirrors what Next uses when no config exists.
const config = {
  plugins: [
    'next/dist/compiled/postcss-flexbugs-fixes',
    [
      'next/dist/compiled/postcss-preset-env',
      {
        browsers: ['chrome 64', 'edge 79', 'firefox 67', 'opera 51', 'safari 12'],
        autoprefixer: { flexbox: 'no-2009' },
        stage: 3,
        features: { 'custom-properties': false },
      },
    ],
  ],
}

export default config
