const rectangleGrid = require('temp-turf-rectangle-grid')
const turf = require('@turf/turf')
const util = require('util')
const config = require('./config')
util.inspect.defaultOptions.depth = null

// берем координаты строим квадрат вокруг, нарезаем на квадраты поменьше и возвращаем центральные точки этих кадратов,
// если не хватает докидываем оригинальных координат
const getPoints = (originalCoords, pointsCount, precision = 12) => {
    if (config.debug) {
        console.log('getPoints input', { originalCoords, pointsCount, precision })
    }
    const needPoints = pointsCount + 10
    let points = []
    const features = turf.featureCollection([...originalCoords.map(coord => turf.point(coord))])

    const enveloped = turf.envelope(features)
    const center = turf.centerOfMass(enveloped)

    const bbox = turf.bbox(enveloped)
    // width
    const wline = turf.lineString([[bbox[0], bbox[1]], [bbox[2], bbox[1]]])
    // height
    const hline = turf.lineString([[bbox[0], bbox[1]], [bbox[0], bbox[3]]])

    const isEven = needPoints % 2 === 0
    const div = isEven ? needPoints / 2 : (needPoints - 1) / 2

    const wlength = turf.length(wline)
    const hlength = turf.length(hline)

    const cellWidth = wlength / div
    const cellHeight = hlength / 2

    const squares = rectangleGrid.default(bbox, cellWidth, cellHeight)
    const centers = turf.featureCollection(squares.features.map(f => turf.centerOfMass(f)))

    centers.features.forEach(f => {
        points.push(f.geometry.coordinates.map(coord => coord.toPrecision(precision)))
    })

    points.push(...enveloped.geometry.coordinates[0].map(coord => coord.map(c => c.toPrecision(precision))))
    if (!isEven) {
        points.push(center.geometry.coordinates.map(coord => coord.toPrecision(precision)))
    }

    const slicedPoints = points.slice(0, pointsCount)

    if (config.debug) {
        console.log('getPoints output', { pl: points.length, spl: slicedPoints.length, points })
    }
    if (slicedPoints.length !== pointsCount) {
        return []
    }

    return slicedPoints
}

module.exports = { getPoints }
