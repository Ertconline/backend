const rectangleGrid = require('temp-turf-rectangle-grid')
const turf = require('@turf/turf')
const util = require('util')
const config = require('./config')
util.inspect.defaultOptions.depth = null

const getPoints = (originalCoords, pointsCount, precision = 8) => {
    if (config.debug) {
        console.log('getPoints input', { originalCoords, pointsCount, precision })
    }

    let points = []
    const features = turf.featureCollection([...originalCoords.map(coord => turf.point(coord))])

    const enveloped = turf.envelope(features)
    const center = turf.centerOfMass(enveloped)

    const bbox = turf.bbox(enveloped)
    // width
    const wline = turf.lineString([[bbox[0], bbox[1]], [bbox[2], bbox[1]]])
    // height
    const hline = turf.lineString([[bbox[0], bbox[1]], [bbox[0], bbox[3]]])

    const isEven = pointsCount % 2 === 0
    const div = isEven ? pointsCount / 2 : (pointsCount - 1) / 2

    const wlength = turf.length(wline)
    const hlength = turf.length(hline)

    const cellWidth = wlength / div
    const cellHeight = hlength / 2

    const squares = rectangleGrid.default(bbox, cellWidth, cellHeight)
    const centers = turf.featureCollection(squares.features.map(f => turf.centerOfMass(f)))

    centers.features.forEach(f => {
        points.push(f.geometry.coordinates.map(coord => coord.toPrecision(precision)))
    })

    if (!isEven) {
        points.push(center.geometry.coordinates.map(coord => coord.toPrecision(precision)))
    }
    points.push(enveloped.geometry.coordinates[0].map(coord => coord.map(c => c.toPrecision(precision))))

    points = points.slice(0, pointsCount)
    if (points.length !== pointsCount) {
        throw new Error('cant create enough points')
    }
    if (config.debug) {
        console.log('getPoints output', { l: points.length, points })
    }

    return points
}

module.exports = { getPoints }
