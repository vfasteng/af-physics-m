﻿/// <reference path="../_reference.d.ts" />

class ForceEntity extends THREE.Object3D
{
    public Material: THREE.MeshBasicMaterial;

    private _baseMesh: THREE.Mesh;

    private _arrowsHash: IHashtable<number, THREE.Mesh>;

    constructor(baseMesh: THREE.Mesh, pointsIdxs: Array<number>, direction: THREE.Vector3, size: number)
    {
        super();

        var self = this;

        self._baseMesh = baseMesh;

        var points = self.GetPointsFromIndexes(baseMesh, pointsIdxs);
        self.SortPoints(points);

        var excludeBox: THREE.Box3 = null;

        self._arrowsHash = new Hashtable<number, THREE.Mesh>();

        self.Material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        var color = ColorUtility.DecimalToTHREE(Settings.LoadArrowsColor);
        self.Material.color.setHex(color.getHex());

        var material = self.Material;

        for (var idx in points)
        {
            var pnt = points[idx];

            if (excludeBox)
            {
                if (excludeBox.containsPoint(pnt))
                {
                    continue;
                }
            }


            var sizeArrow = size;

            var coneGeom = new THREE.CylinderGeometry(0, sizeArrow / 4, sizeArrow, 12, 1, false);
            var lineGeom = new THREE.CylinderGeometry(sizeArrow / 10, sizeArrow / 10, sizeArrow, 12, 1, false);

            // Create arrow Z (0,0,1)
            var arrowZGeom = coneGeom.clone();
            GeomRotate(arrowZGeom, 90, 0, 0);
            GeomTranslate(arrowZGeom, 0, 0, -(sizeArrow / 2));
            var arrowZMesh = new THREE.Mesh(arrowZGeom, material);

            var arrowZLine = lineGeom.clone();
            GeomRotate(arrowZLine, 90, 0, 0);
            GeomTranslate(arrowZLine, 0, 0, -(sizeArrow * 1.5));
            arrowZMesh.add(new THREE.Mesh(arrowZLine, material));

            // Translate to dest point
            arrowZMesh.position.set(pnt.x, pnt.y, pnt.z);
            // Get angle from direction
            var angle = GetHorizontalAngle(direction);
            // Rotate mesh by direction
            arrowZMesh.rotation.set(angle.x, angle.y, angle.z);

            this.add(arrowZMesh);

            var index = baseMesh.geometry.vertices.indexOf(pnt);
            self._arrowsHash.put(index, arrowZMesh);

            var minBox = pnt.clone().sub(new THREE.Vector3(size / 2, size / 2, size / 2));
            var maxBox = pnt.clone().add(new THREE.Vector3(size / 2, size / 2, size / 2));
            excludeBox = new THREE.Box3(minBox, maxBox);
        }

        // add attributes
        this.userData = new ObjectData(EntityType.ForceArrow, true);
    }

    public Update()
    {
        var self = this;

        self._arrowsHash.each(function (vertIdx: number, mesh: THREE.Mesh)
        {
            var vert = self._baseMesh.geometry.vertices[vertIdx];
            vert = vert.clone().applyMatrix4(self._baseMesh.matrixWorld);
            mesh.position.set(vert.x, vert.y, vert.z);
        });
    }

    private GetPointsFromIndexes(baseMesh: THREE.Mesh, pointsIdxs: Array<number>): Array<THREE.Vector3>
    {
        var outPoints = new Array<THREE.Vector3>();

        var vertices = baseMesh.geometry.vertices;
        pointsIdxs.forEach(function (pntIdx: number)
        {
            var pnt = vertices[pntIdx];
            outPoints.push(pnt);
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