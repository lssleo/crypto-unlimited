const { assert, expect } = require('chai')
const { ethers } = require('hardhat')

const { AddressZero } = ethers.constants
const URI = 'http://uri'
const BASICNFTURI = 'BasicNftUri'
const RARENFTURI = 'RareNftUri'
const SUPERRARENFTURI = 'SuperRareNftUri'
const SALESSBTURI = 'SalesSbtUri'
const RARESBTURI = 'RareSbtUri'
const SUPERSBTURI = 'SuperSecretSbtUri'
const REGISTRY_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('REGISTRY_ROLE'))
const MARKETPLACE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MARKETPLACE_ROLE'))
const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'))
const SOULBOUNDS_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SOULBOUNDS_ROLE'))
const randomAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20))

let accounts,
    owner,
    registryRole,
    marketplaceRole,
    minterRole,
    sbtRole,
    anyone,
    user1,
    user2,
    control,
    registry,
    marketplace,
    minter,
    soulbounds,
    holder,
    random

describe('Control', async () => {
    beforeEach(async () => {
        accounts = await ethers.getSigners()
        owner = accounts[0]
        registryRole = accounts[1]
        marketplaceRole = accounts[2]
        minterRole = accounts[3]
        sbtRole = accounts[4]
        anyone = accounts[5]
        user1 = accounts[6]
        user2 = accounts[7]

        ControlContract = await ethers.getContractFactory('Control')
        control = await ControlContract.deploy(
            registryRole.address,
            marketplaceRole.address,
            minterRole.address,
            sbtRole.address
        )
        await control.deployed()

        const RegistryContract = await ethers.getContractFactory('Registry')
        registry = await RegistryContract.deploy()
        await registry.deployed()

        const MarketplaceContract = await ethers.getContractFactory('Marketplace')
        marketplace = await MarketplaceContract.deploy(control.address, registry.address)
        await marketplace.deployed()

        const MinterContract = await ethers.getContractFactory('Minter')
        minter = await MinterContract.deploy(control.address, registry.address)
        await minter.deployed()

        const SoulboundsContract = await ethers.getContractFactory('Soulbounds')
        soulbounds = await SoulboundsContract.deploy(
            control.address,
            registry.address,
            SALESSBTURI,
            RARESBTURI,
            SUPERSBTURI
        )
        await soulbounds.deployed()

        const HolderContract = await ethers.getContractFactory('Holder')
        holder = await HolderContract.deploy([owner.address], ['100'])
        await holder.deployed()

        const VRFCoordinatorMock = await ethers.getContractFactory('VRFCoordinatorV2Mock')
        const VRFMock = await VRFCoordinatorMock.deploy(0, 0)
        await VRFMock.createSubscription()
        await VRFMock.fundSubscription(1, ethers.utils.parseEther('7')) // subId = 1

        RandomContract = await ethers.getContractFactory('Random')
        random = await RandomContract.deploy(registry.address, VRFMock.address, [
            BASICNFTURI,
            RARENFTURI,
            SUPERRARENFTURI,
        ])
        await random.deployed()
        await VRFMock.addConsumer('1', random.address)

        await control.connect(registryRole).setRegistry(registry.address)
        await registry.setMinterContract(minter.address)
        await registry.setMarketplaceContract(marketplace.address)
        await registry.setRandomContract(random.address)
        await registry.setSoulboundsContract(soulbounds.address)
        await registry.setHolderAddress(holder.address)
        await registry.setOracleParams(
            '1',
            '0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f',
            '500000'
        )
    })

    it('Registry address set correct', async () => {
        assert.equal(await control.getRegistryAddress(), registry.address)
    })
    it('Reverts if try set registry to zero address or the same address', async () => {
        await expect(control.connect(registryRole).setRegistry(AddressZero)).to.be.revertedWith(
            'Control: Zero address'
        )
        await expect(
            control.connect(registryRole).setRegistry(registry.address)
        ).to.be.revertedWith('Control: Setting the same value')
    })
    it('Reverts if not registry role try set registry address', async () => {
        await expect(control.connect(owner).setRegistry(registry.address)).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${REGISTRY_ROLE}`
        )
        await expect(
            control.connect(marketplaceRole).setRegistry(registry.address)
        ).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${REGISTRY_ROLE}`
        )
        await expect(control.connect(minterRole).setRegistry(registry.address)).to.be.revertedWith(
            `AccessControl: account ${minterRole.address.toLowerCase()} is missing role ${REGISTRY_ROLE}`
        )
        await expect(control.connect(sbtRole).setRegistry(registry.address)).to.be.revertedWith(
            `AccessControl: account ${sbtRole.address.toLowerCase()} is missing role ${REGISTRY_ROLE}`
        )
        await expect(control.connect(anyone).setRegistry(registry.address)).to.be.revertedWith(
            `AccessControl: account ${anyone.address.toLowerCase()} is missing role ${REGISTRY_ROLE}`
        )
        await expect(control.connect(user1).setRegistry(registry.address)).to.be.revertedWith(
            `AccessControl: account ${user1.address.toLowerCase()} is missing role ${REGISTRY_ROLE}`
        )
        await expect(control.connect(user2).setRegistry(registry.address)).to.be.revertedWith(
            `AccessControl: account ${user2.address.toLowerCase()} is missing role ${REGISTRY_ROLE}`
        )
    })
    it('Marketplace fee sets correct', async () => {
        await control.connect(marketplaceRole).setMarketplaceFee('1000')
        assert.equal(await marketplace.getMarketplaceFee(), '1000')
    })
    it('Reverts if not marketplace role try set marketplace fee', async () => {
        await expect(control.connect(owner).setMarketplaceFee('10000')).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${MARKETPLACE_ROLE}`
        )
        await expect(control.connect(registryRole).setMarketplaceFee('10000')).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${MARKETPLACE_ROLE}`
        )
        await expect(control.connect(minterRole).setMarketplaceFee('10000')).to.be.revertedWith(
            `AccessControl: account ${minterRole.address.toLowerCase()} is missing role ${MARKETPLACE_ROLE}`
        )
        await expect(control.connect(sbtRole).setMarketplaceFee('10000')).to.be.revertedWith(
            `AccessControl: account ${sbtRole.address.toLowerCase()} is missing role ${MARKETPLACE_ROLE}`
        )
        await expect(control.connect(anyone).setMarketplaceFee('10000')).to.be.revertedWith(
            `AccessControl: account ${anyone.address.toLowerCase()} is missing role ${MARKETPLACE_ROLE}`
        )
        await expect(control.connect(user1).setMarketplaceFee('10000')).to.be.revertedWith(
            `AccessControl: account ${user1.address.toLowerCase()} is missing role ${MARKETPLACE_ROLE}`
        )
        await expect(control.connect(user2).setMarketplaceFee('10000')).to.be.revertedWith(
            `AccessControl: account ${user2.address.toLowerCase()} is missing role ${MARKETPLACE_ROLE}`
        )
    })

    it('Minter price sets correct', async () => {
        await control.connect(minterRole).setPriceMinter('10000')
        assert.equal(await minter.getPrice(), '10000')
    })

    it('Reverts if not minter role try set minter price', async () => {
        await expect(control.connect(owner).setPriceMinter('10000')).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(registryRole).setPriceMinter('10000')).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(marketplaceRole).setPriceMinter('10000')).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(sbtRole).setPriceMinter('10000')).to.be.revertedWith(
            `AccessControl: account ${sbtRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
    })
    it('Minter currency sets correct', async () => {
        await control.connect(minterRole).setCurrencyMinter(randomAddress)
        assert.equal((await minter.getCurrency()).toLowerCase(), randomAddress)
    })
    it('Reverts if not minter role try set minter currency', async () => {
        await expect(control.connect(owner).setCurrencyMinter(randomAddress)).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(
            control.connect(registryRole).setCurrencyMinter(randomAddress)
        ).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(
            control.connect(marketplaceRole).setCurrencyMinter(randomAddress)
        ).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(sbtRole).setCurrencyMinter(randomAddress)).to.be.revertedWith(
            `AccessControl: account ${sbtRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
    })
    it('Whitelist sets correct', async () => {
        await control.connect(minterRole).setWhitelistMinter([randomAddress])
        assert.equal(await random.isWhitelisted(randomAddress), true)
    })
    it('Reverts if not minter role try set whitelist', async () => {
        await expect(control.connect(owner).setWhitelistMinter([randomAddress])).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(
            control.connect(registryRole).setWhitelistMinter([randomAddress])
        ).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(
            control.connect(marketplaceRole).setWhitelistMinter([randomAddress])
        ).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(
            control.connect(sbtRole).setWhitelistMinter([randomAddress])
        ).to.be.revertedWith(
            `AccessControl: account ${sbtRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
    })
    it('Minter activated and disabled correct', async () => {
        await control.connect(minterRole).activateMinter()
        assert.equal(await minter.getStatus(), true)
        await control.connect(minterRole).disableMinter()
        assert.equal(await minter.getStatus(), false)
    })
    it('Reverts if not minter try activate minter', async () => {
        await expect(control.connect(owner).activateMinter()).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(registryRole).activateMinter()).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(marketplaceRole).activateMinter()).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(sbtRole).activateMinter()).to.be.revertedWith(
            `AccessControl: account ${sbtRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
    })
    it('Reverts if not minter try disable minter', async () => {
        await expect(control.connect(owner).disableMinter()).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(registryRole).disableMinter()).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(marketplaceRole).disableMinter()).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
        await expect(control.connect(sbtRole).disableMinter()).to.be.revertedWith(
            `AccessControl: account ${sbtRole.address.toLowerCase()} is missing role ${MINTER_ROLE}`
        )
    })
    it('Soulbounds mints correct', async () => {
        await control.connect(sbtRole).mintSoulbounds(owner.address, '0', '1')
        assert.equal(await soulbounds.balanceOf(owner.address, '0'), '1')
    })
    it('Reverts if not soulbound role try mint soulbounds', async () => {
        await expect(
            control.connect(owner).mintSoulbounds(owner.address, '0', '1')
        ).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
        await expect(
            control.connect(registryRole).mintSoulbounds(owner.address, '0', '1')
        ).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
        await expect(
            control.connect(marketplaceRole).mintSoulbounds(owner.address, '0', '1')
        ).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
        await expect(
            control.connect(minterRole).mintSoulbounds(owner.address, '0', '1')
        ).to.be.revertedWith(
            `AccessControl: account ${minterRole.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
    })

    it('Soulbound token sets correct', async () => {
        await control.connect(sbtRole).setSoulboundToken('5', BASICNFTURI, true)
        assert.equal(await soulbounds.uri('5'), BASICNFTURI)
        assert.equal(await soulbounds.isSoulbound('5'), true)
    })

    it('Reverts if not soulbound role try set soulbound token', async () => {
        await expect(
            control.connect(owner).setSoulboundToken('5', BASICNFTURI, true)
        ).to.be.revertedWith(
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
        await expect(
            control.connect(registryRole).setSoulboundToken('5', BASICNFTURI, true)
        ).to.be.revertedWith(
            `AccessControl: account ${registryRole.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
        await expect(
            control.connect(marketplaceRole).setSoulboundToken('5', BASICNFTURI, true)
        ).to.be.revertedWith(
            `AccessControl: account ${marketplaceRole.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
        await expect(
            control.connect(minterRole).setSoulboundToken('5', BASICNFTURI, true)
        ).to.be.revertedWith(
            `AccessControl: account ${minterRole.address.toLowerCase()} is missing role ${SOULBOUNDS_ROLE}`
        )
    })
})
