﻿/// <reference path="../_reference.d.ts" />

class MomentEntity extends THREE.Object3D
{
    public Material: THREE.MeshBasicMaterial;

    private _baseMesh: THREE.Mesh;

    private _size: number;

    private _pointsIdxs: Array<number>;

    private _refPointEnt: RefPointEntity;

    private _meshes: Array<THREE.Mesh>;

    constructor(baseMesh: THREE.Mesh, refPointEnt: RefPointEntity, pointsIdxs: Array<number>, direction: THREE.Vector3, minSize: number)
    {
        super();

        var self = this;

        self._baseMesh = baseMesh;
        self._refPointEnt = refPointEnt;
        self._meshes = new Array<THREE.Mesh>();

        var points = self.GetPointsFromIndexes(baseMesh, pointsIdxs);
        self.SortPoints(points);

        var excludeBox: THREE.Box3 = null;

        self._pointsIdxs = pointsIdxs;

        self.Material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        var color = ColorUtility.DecimalToTHREE(Settings.MomentSymbolColor);
        self.Material.color.setHex(color.getHex());

        var material = self.Material;

        var bboxGeom = new THREE.Geometry();
        bboxGeom.vertices = points;
        bboxGeom.computeBoundingBox();

        var pnt = self._refPointEnt.getWorldPosition();

        var size = Math.max(bboxGeom.boundingBox.size().x, bboxGeom.boundingBox.size().y);
        size = Math.max(size, minSize);
        self._size = size;

        // Get angle from direction
        var angle = GetHorizontalAngle(direction);

        var circleRadius = size / 2;
        var arrowSize = size / 3;

        var spline3 = new THREE.SplineCurve3(
            [
                new THREE.Vector3(0, -circleRadius, 0),
                new THREE.Vector3(circleRadius * 0.6, -circleRadius * 0.7, 0),
                new THREE.Vector3(circleRadius, 0, 0),
                new THREE.Vector3(circleRadius * 0.6, circleRadius * 0.7, 0),
                new THREE.Vector3(0, circleRadius, 0)
            ]);

        var geometry = new THREE.TubeGeometry(
            spline3,  //path
            20,    //segments
            circleRadius / 6, //radius
            8,     //radiusSegment [Integer] The number of segments that make up the cross-section, default is 8 
            false  //closed
        );


        var circleMesh = new THREE.Mesh(geometry, material);
        // Rotate mesh by direction
        circleMesh.rotation.set(angle.x, angle.y, angle.z);
        // Move to position
        circleMesh.position.set(pnt.x, pnt.y, pnt.z);
        this.add(circleMesh);

        self._meshes.push(circleMesh);

        // Create arrow
        //
        var sizeArrow = circleRadius;
        var coneGeom = new THREE.CylinderGeometry(0, sizeArrow / 2, sizeArrow, 12, 1, false);
        GeomRotate(coneGeom, 0, 0, 110);
        GeomTranslate(coneGeom, 0, -circleRadius, 0);
        var arrowMesh = new THREE.Mesh(coneGeom, material);
        // Rotate mesh by direction
        arrowMesh.rotation.set(angle.x, angle.y, angle.z);
        // Move to dest position
        arrowMesh.position.set(pnt.x, pnt.y, pnt.z);
        this.add(arrowMesh);

        self._meshes.push(arrowMesh);

        // add attributes
        this.userData = new ObjectData(EntityType.MomentSymb, true);
    }

    public Update()
    {
        var self = this;

        var pnt = self._refPointEnt.getWorldPosition();

        var circleRadius = self._size / 2;
        var zOffset = circleRadius * 1.2;
        var meshBox = self._baseMesh.geometry.boundingBox;

        self._meshes.forEach((mesh) =>
        {
            mesh.position.set(pnt.x, pnt.y, pnt.z);
        });
    }

    private GetPointsFromIndexes(baseMesh: THREE.Mesh, pointsIdxs: Array<number>): Array<THREE.Vector3>
    {
        var outPoints = new Array<THREE.Vector3>();

        var vertices = baseMesh.geometry.vertices;
        pointsIdxs.forEach(function (pntIdx: number)
        {
            var pnt = vertices[pntIdx];
            outPoints.push(pnt.clone());
        });

        return outPoints;
    }

    private SortPoints(points: Array<THREE.Vector3>)
    {
        // Sort point by XY
        //
        points.sort(function (a, b)
        {
            if (a.y > b.y)
            {
                return 1;
            }
            else if (a.y < b.y)
            {
                return -1;
            }

            if (a.x > b.x)
            {
                return 1;
            }
            else if (a.x < b.x)
            {
                return -1;
            }

            if (a.z > b.z)
            {
                return 1;
            }
            else if (a.z < b.z)
            {
                return -1;
            }

            return 0;
        });
    }
}